import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getBalance, grantCredits, listTransactions, spendCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import type { PaymentEvent, ProviderId, RefundEvent } from "./providers";
import { order, subscription } from "./schema";

// Fake providers: a webhook payload is the PaymentEvent as JSON. Each
// provider's own tests cover how it maps its refund events.
const { stripe, waffo } = vi.hoisted(() => {
  const fakeProvider = (id: "stripe" | "waffo") => ({
    id,
    configured: () => true,
    parseWebhook: async (payload: string) => JSON.parse(payload) as PaymentEvent | null,
  });
  return { stripe: fakeProvider("stripe"), waffo: fakeProvider("waffo") };
});
vi.mock("./providers/stripe", () => ({ stripeProvider: stripe }));
vi.mock("./providers/waffo", () => ({ waffoProvider: waffo }));

const { handleWebhook } = await import("./webhook");

let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Buyer" },
    { method: "admin" },
  );
  userId = user.id;
  // Start from zero, so balances below count only what the tests grant.
  const signup = await getBalance(userId);
  if (signup > 0) {
    await spendCredits({ userId, amount: signup, reason: "test", idempotencyKey: `reset:${userId}` });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A paid order whose credits the user received.
async function paidOrder({
  provider = "stripe",
  credits = 100,
  amount = 500,
}: { provider?: ProviderId; credits?: number; amount?: number } = {}) {
  const id = randomUUID();
  await getDb().insert(order).values({
    id,
    userId,
    packId: "small",
    credits,
    amount,
    currency: "usd",
    provider,
    status: "paid",
    paidAt: new Date(),
  });
  await grantCredits({ userId, amount: credits, reason: "purchase", idempotencyKey: `order:${id}` });
  return id;
}

// A live subscription that has been charged once.
async function chargedSubscription({ interval = "month" as "month" | "year", credits = 1000 } = {}) {
  const id = randomUUID();
  await getDb().insert(subscription).values({
    id,
    userId,
    planId: interval === "year" ? "pro-yearly" : "pro",
    interval,
    credits,
    amount: interval === "year" ? 10000 : 1000,
    currency: "usd",
    provider: "stripe",
    status: "active",
  });
  await grantCredits({ userId, amount: credits, reason: "subscription", idempotencyKey: `sub:${id}` });
  return id;
}

function refund(provider: string, event: Omit<RefundEvent, "kind" | "refundId"> & { refundId?: string }) {
  const payload: RefundEvent = { kind: "refund", refundId: `re_${randomUUID()}`, ...event };
  return handleWebhook(provider, JSON.stringify(payload), new Headers());
}

test("a full refund takes back the order's credits once", async () => {
  const orderId = await paidOrder();
  const event = { refundId: `re_${randomUUID()}`, target: { orderId }, refunded: 500, charged: 500 };

  await refund("stripe", event);
  await refund("stripe", event); // Providers may repeat events.

  expect(await getBalance(userId)).toBe(0);
  const [latest] = await listTransactions(userId);
  expect(latest).toMatchObject({ amount: -100, reason: "refunded payment" });
});

test("a partial refund takes back that share of the credits", async () => {
  const orderId = await paidOrder({ credits: 100, amount: 500 });

  await refund("stripe", { target: { orderId }, refunded: 200, charged: 500 });
  expect(await getBalance(userId)).toBe(60);

  // A second refund of the rest takes the rest.
  await refund("stripe", { target: { orderId }, refunded: 300, charged: 500 });
  expect(await getBalance(userId)).toBe(0);
});

test("credits already spent are taken only as far as the balance goes, and the shortfall is logged", async () => {
  const error = vi.spyOn(log, "error");
  const orderId = await paidOrder({ credits: 100 });
  await spendCredits({ userId, amount: 70, reason: "video", idempotencyKey: `spend:${userId}` });

  await refund("stripe", { target: { orderId }, refunded: 500, charged: 500 });

  expect(await getBalance(userId)).toBe(0);
  expect(error).toHaveBeenCalledWith(
    "payment.refund_shortfall",
    expect.objectContaining({ userId, orderId, owed: 100, taken: 30 }),
  );
});

test("a refunded monthly charge takes back that month's credits", async () => {
  const subscriptionId = await chargedSubscription({ credits: 1000 });

  await refund("stripe", { target: { subscriptionId }, refunded: 1000, charged: 1000 });

  expect(await getBalance(userId)).toBe(0);
});

test("a refunded yearly charge takes back up to a year of credits", async () => {
  const subscriptionId = await chargedSubscription({ interval: "year", credits: 1000 });
  // The sweep granted two more months.
  await grantCredits({ userId, amount: 2000, reason: "subscription", idempotencyKey: `months:${subscriptionId}` });

  await refund("stripe", { target: { subscriptionId }, refunded: 5000, charged: 10000 });

  // Half a year is 6000 credits; the user had 3000.
  expect(await getBalance(userId)).toBe(0);
});

test("a refund for an order that isn't paid, unknown or another provider's changes nothing", async () => {
  const warn = vi.spyOn(log, "warn");
  const waffoOrder = await paidOrder({ provider: "waffo" });
  const pendingId = randomUUID();
  await getDb().insert(order).values({
    id: pendingId,
    userId,
    packId: "small",
    credits: 100,
    amount: 500,
    currency: "usd",
    provider: "stripe",
  });

  await refund("stripe", { target: { orderId: waffoOrder }, refunded: 500, charged: 500 });
  await refund("stripe", { target: { orderId: pendingId }, refunded: 500, charged: 500 });
  await refund("stripe", { target: { orderId: randomUUID() }, refunded: 500, charged: 500 });
  await refund("stripe", { target: { subscriptionId: randomUUID() }, refunded: 500, charged: 500 });

  expect(await getBalance(userId)).toBe(100);
  expect(warn).toHaveBeenCalledTimes(4);
  expect(warn).toHaveBeenCalledWith("payment.refund_unmatched", expect.objectContaining({ provider: "stripe" }));
});
