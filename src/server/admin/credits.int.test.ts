import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { auth } from "@/server/auth";
import { signupCredits } from "@/server/credits/config";
import { getBalance, listTransactions } from "@/server/credits";
import { pageNotifications } from "@/server/notifications";
import { addCredits, InvalidAddCreditsError, UnknownUserError } from "./credits";
import { listUsers } from "./users";

async function createUser() {
  const ctx = await auth.$context;
  return ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Test User" },
    { method: "admin" },
  );
}

test("adds credits once per request, as an admin ledger entry", async () => {
  const user = await createUser();
  const requestId = randomUUID();

  expect(await addCredits({ userId: user.id, amount: 25, requestId })).toBe(signupCredits + 25);
  // A repeated request (double click, retry) changes nothing.
  expect(await addCredits({ userId: user.id, amount: 25, requestId })).toBe(signupCredits + 25);

  expect(await getBalance(user.id)).toBe(signupCredits + 25);
  const [latest] = await listTransactions(user.id);
  expect(latest).toMatchObject({ amount: 25, reason: "admin" });
  expect((await pageNotifications(user.id)).notifications).toMatchObject([
    { type: "credits_added", data: { credits: 25 } },
  ]);
});

test("rejects amounts that aren't whole numbers from 1 to 1,000,000", async () => {
  const user = await createUser();
  for (const amount of [0, -5, 1.5, 1_000_001, Number.NaN]) {
    await expect(addCredits({ userId: user.id, amount, requestId: randomUUID() })).rejects.toThrow(
      InvalidAddCreditsError,
    );
  }
  expect(await getBalance(user.id)).toBe(signupCredits);
});

test("rejects unknown users and empty request IDs", async () => {
  await expect(
    addCredits({ userId: randomUUID(), amount: 5, requestId: randomUUID() }),
  ).rejects.toThrow(UnknownUserError);
  const user = await createUser();
  await expect(addCredits({ userId: user.id, amount: 5, requestId: "" })).rejects.toThrow(
    InvalidAddCreditsError,
  );
});

test("the user list includes each user's balance", async () => {
  const user = await createUser();
  await addCredits({ userId: user.id, amount: 7, requestId: randomUUID() });

  const { users } = await listUsers({ query: user.email });

  expect(users.find((u) => u.id === user.id)?.balance).toBe(signupCredits + 7);
});
