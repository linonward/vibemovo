import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { order } from "@/server/payment/schema";
import { listAllOrders } from "./orders";

type Status = (typeof order.$inferInsert)["status"];
type Provider = (typeof order.$inferInsert)["provider"];

const cleanup: string[] = [];

afterEach(async () => {
  const ctx = await auth.$context;
  // Deleting a user deletes their orders.
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

// A user whose email contains `tag`, so a search finds only this test's orders.
async function buyer(tag: string) {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `buyer-${tag}-${randomUUID().slice(0, 4)}@example.com`, name: "Buyer" },
    { method: "admin" },
  );
  cleanup.push(user.id);
  return user;
}

async function addOrder(
  userId: string,
  { status = "paid", provider = "stripe", minutesAgo = 0 }: { status?: Status; provider?: Provider; minutesAgo?: number } = {},
) {
  const [row] = await getDb()
    .insert(order)
    .values({
      userId,
      packId: "small",
      credits: 100,
      amount: 500,
      currency: "usd",
      status,
      provider,
      providerSessionId: `cs_${randomUUID()}`,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
      paidAt: status === "paid" ? new Date() : null,
    })
    .returning();
  return row;
}

const tag = () => randomUUID().slice(0, 8);

test("lists every user's orders, newest first, with the buyer's email", async () => {
  const t = tag();
  const alice = await buyer(t);
  const bob = await buyer(t);
  const older = await addOrder(alice.id, { minutesAgo: 10 });
  const newer = await addOrder(bob.id, { status: "pending", provider: "waffo", minutesAgo: 1 });

  const { orders, total } = await listAllOrders({ query: t });

  expect(total).toBe(2);
  expect(orders.map((o) => o.id)).toEqual([newer.id, older.id]);
  expect(orders[0]).toEqual({
    id: newer.id,
    userId: bob.id,
    email: bob.email,
    packId: "small",
    credits: 100,
    amount: 500,
    currency: "usd",
    status: "pending",
    provider: "waffo",
    providerSessionId: newer.providerSessionId,
    createdAt: newer.createdAt,
    paidAt: null,
  });
});

test("filters by status and provider", async () => {
  const t = tag();
  const user = await buyer(t);
  const paidStripe = await addOrder(user.id, { status: "paid", provider: "stripe" });
  await addOrder(user.id, { status: "pending", provider: "stripe" });
  const paidWaffo = await addOrder(user.id, { status: "paid", provider: "waffo" });

  const paid = await listAllOrders({ query: t, status: "paid" });
  const stripePaid = await listAllOrders({ query: t, status: "paid", provider: "stripe" });

  expect(paid.total).toBe(2);
  expect(paid.orders.map((o) => o.id).sort()).toEqual([paidStripe.id, paidWaffo.id].sort());
  expect(stripePaid.orders.map((o) => o.id)).toEqual([paidStripe.id]);
});

test("finds an order by its ID or the provider's session ID", async () => {
  const user = await buyer(tag());
  const target = await addOrder(user.id);
  await addOrder(user.id);

  const byId = await listAllOrders({ query: ` ${target.id} ` });
  const bySession = await listAllOrders({ query: target.providerSessionId ?? "" });

  expect(byId.orders.map((o) => o.id)).toEqual([target.id]);
  expect(bySession.orders.map((o) => o.id)).toEqual([target.id]);
});

test("matches part of the email ignoring case, with % and _ as plain characters", async () => {
  const t = tag();
  const user = await buyer(t);
  await addOrder(user.id);

  expect((await listAllOrders({ query: t.toUpperCase() })).total).toBe(1);
  expect((await listAllOrders({ query: `%_${t}` })).total).toBe(0);
});

test("pages through the matches", async () => {
  const t = tag();
  const user = await buyer(t);
  for (let i = 0; i < 3; i++) await addOrder(user.id, { minutesAgo: i });

  const first = await listAllOrders({ query: t, page: 1, pageSize: 2 });
  const second = await listAllOrders({ query: t, page: 2, pageSize: 2 });

  expect([first.total, second.total]).toEqual([3, 3]);
  expect(first.orders).toHaveLength(2);
  expect(second.orders).toHaveLength(1);
  expect(new Set([...first.orders, ...second.orders].map((o) => o.id)).size).toBe(3);
});
