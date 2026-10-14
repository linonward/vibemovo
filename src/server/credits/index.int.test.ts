import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { signupCredits } from "./config";
import {
  getBalance,
  grantCredits,
  InsufficientCreditsError,
  listTransactions,
  spendCredits,
  spendUpTo,
  usedIdempotencyKeys,
} from "./index";
import { creditBalance, creditTransaction } from "./schema";

async function createUser() {
  const ctx = await auth.$context;
  return ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Test User" },
    { method: "admin" },
  );
}

// A user starting from zero, with the signup grant spent.
async function emptyUser() {
  const user = await createUser();
  if (signupCredits > 0) {
    await spendCredits({ userId: user.id, amount: signupCredits, reason: "test", idempotencyKey: randomUUID() });
  }
  return user.id;
}

const key = () => randomUUID();

test("a new user receives the signup credits once", async () => {
  const user = await createUser();

  expect(await getBalance(user.id)).toBe(signupCredits);
  const rows = await getDb().select().from(creditTransaction).where(eq(creditTransaction.userId, user.id));
  expect(rows).toMatchObject([{ amount: signupCredits, reason: "signup", idempotencyKey: `signup:${user.id}` }]);
});

test("an unknown user has a balance of zero", async () => {
  expect(await getBalance(randomUUID())).toBe(0);
});

test("grant adds and spend subtracts, returning the new balance", async () => {
  const userId = await emptyUser();

  expect(await grantCredits({ userId, amount: 30, reason: "test", idempotencyKey: key() })).toBe(30);
  expect(await spendCredits({ userId, amount: 12, reason: "test", idempotencyKey: key() })).toBe(18);
  expect(await getBalance(userId)).toBe(18);
});

test("repeating an idempotency key applies the change once", async () => {
  const userId = await emptyUser();
  const grant = { userId, amount: 5, reason: "test", idempotencyKey: key() };

  expect(await grantCredits(grant)).toBe(5);
  expect(await grantCredits(grant)).toBe(5);
  const spend = { userId, amount: 2, reason: "test", idempotencyKey: key() };
  expect(await spendCredits(spend)).toBe(3);
  expect(await spendCredits(spend)).toBe(3);
});

test("tells which idempotency keys a change has used", async () => {
  const userId = await emptyUser();
  const [granted, spent, unused] = [key(), key(), key()];
  await grantCredits({ userId, amount: 5, reason: "test", idempotencyKey: granted });
  await spendCredits({ userId, amount: 1, reason: "test", idempotencyKey: spent });

  expect(await usedIdempotencyKeys([granted, spent, unused])).toEqual(new Set([granted, spent]));
  expect(await usedIdempotencyKeys([])).toEqual(new Set());
});

test("spending more than the balance fails and changes nothing", async () => {
  const userId = await emptyUser();
  await grantCredits({ userId, amount: 3, reason: "test", idempotencyKey: key() });
  const failedKey = key();

  await expect(
    spendCredits({ userId, amount: 4, reason: "test", idempotencyKey: failedKey }),
  ).rejects.toBeInstanceOf(InsufficientCreditsError);

  expect(await getBalance(userId)).toBe(3);
  const failed = await getDb().select().from(creditTransaction).where(eq(creditTransaction.idempotencyKey, failedKey));
  expect(failed).toEqual([]);
});

test("logs each applied change, not repeats or refused spends", async () => {
  const userId = await emptyUser();
  const info = vi.spyOn(log, "info");
  const grant = { userId, amount: 5, reason: "test grant", idempotencyKey: key() };
  await grantCredits(grant);
  await grantCredits(grant);
  await spendCredits({ userId, amount: 2, reason: "test spend", idempotencyKey: key() });
  await expect(spendCredits({ userId, amount: 9, reason: "test", idempotencyKey: key() })).rejects.toThrow();

  expect(info.mock.calls.filter(([event, fields]) => event === "credits.changed" && fields?.userId === userId)).toEqual([
    ["credits.changed", { userId, delta: 5, reason: "test grant", balance: 5 }],
    ["credits.changed", { userId, delta: -2, reason: "test spend", balance: 3 }],
  ]);
  info.mockRestore();
});

test("concurrent spends never overdraw", async () => {
  const userId = await emptyUser();
  await grantCredits({ userId, amount: 5, reason: "test", idempotencyKey: key() });

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => spendCredits({ userId, amount: 1, reason: "test", idempotencyKey: key() })),
  );

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
  for (const r of results) {
    if (r.status === "rejected") expect(r.reason).toBeInstanceOf(InsufficientCreditsError);
  }
  expect(await getBalance(userId)).toBe(0);
});

test.each([0, -1, 1.5])("rejects an amount of %s", async (amount) => {
  const userId = await emptyUser();

  await expect(grantCredits({ userId, amount, reason: "test", idempotencyKey: key() })).rejects.toThrow(RangeError);
  await expect(spendCredits({ userId, amount, reason: "test", idempotencyKey: key() })).rejects.toThrow(RangeError);
});

test("deleting a user removes their credits", async () => {
  const user = await createUser();
  const ctx = await auth.$context;

  await ctx.internalAdapter.deleteUser(user.id);

  const db = getDb();
  expect(await db.select().from(creditBalance).where(eq(creditBalance.userId, user.id))).toEqual([]);
  expect(await db.select().from(creditTransaction).where(eq(creditTransaction.userId, user.id))).toEqual([]);
});

test("lists a user's transactions newest first", async () => {
  const userId = await emptyUser();
  await grantCredits({ userId, amount: 5, reason: "purchase", idempotencyKey: key() });
  await spendCredits({ userId, amount: 2, reason: "chat", idempotencyKey: key() });
  const other = await createUser();

  const rows = await listTransactions(userId);

  expect(rows.map((r) => [r.amount, r.reason])).toEqual([
    [-2, "chat"],
    [5, "purchase"],
    ...(signupCredits > 0 ? [[-signupCredits, "test"], [signupCredits, "signup"]] : []),
  ]);
  expect(Object.keys(rows[0]).sort()).toEqual(["amount", "createdAt", "id", "reason"]);
  expect((await listTransactions(userId, { limit: 1 })).map((r) => r.reason)).toEqual(["chat"]);
  expect(await listTransactions(other.id)).not.toContainEqual(expect.objectContaining({ reason: "chat" }));
});

test("spendUpTo takes the amount, or the whole balance if that is less, once per key", async () => {
  const userId = await emptyUser();
  await grantCredits({ userId, amount: 30, reason: "test", idempotencyKey: key() });

  expect(await spendUpTo({ userId, amount: 10, reason: "test", idempotencyKey: key() })).toBe(10);
  const rest = { userId, amount: 50, reason: "test", idempotencyKey: key() };
  expect(await spendUpTo(rest)).toBe(20);
  await grantCredits({ userId, amount: 5, reason: "test", idempotencyKey: key() });
  expect(await spendUpTo(rest)).toBe(0);
  expect(await getBalance(userId)).toBe(5);
});

test("spendUpTo takes nothing from an empty or missing balance", async () => {
  const userId = await emptyUser();

  expect(await spendUpTo({ userId, amount: 10, reason: "test", idempotencyKey: key() })).toBe(0);
  expect(await spendUpTo({ userId: randomUUID(), amount: 10, reason: "test", idempotencyKey: key() })).toBe(0);
  // Only the signup grant and its reset.
  expect(await listTransactions(userId)).toHaveLength(2);
});
