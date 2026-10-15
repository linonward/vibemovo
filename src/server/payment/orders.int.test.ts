import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { capture } from "@/server/analytics";
import { auth } from "@/server/auth";
import { getBalance, grantCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { pageNotifications } from "@/server/notifications";
import type { OrderEvent, PaymentEvent, PaymentProvider } from "./providers";
import { order } from "./schema";

// Fake providers: checkout returns a session, and a webhook payload is the
// PaymentEvent as JSON. Each provider's own tests cover its API and signatures.
const { stripe, waffo } = vi.hoisted(() => {
  const fakeProvider = (id: "stripe" | "waffo") => ({
    id,
    configured: () => true,
    createCheckout: vi.fn<PaymentProvider["createCheckout"]>(async () => ({
      sessionId: `cs_${crypto.randomUUID()}`,
      url: `https://${id}.test/checkout`,
    })),
    parseWebhook: (payload: string) => JSON.parse(payload) as PaymentEvent | null,
  });
  return { stripe: fakeProvider("stripe"), waffo: fakeProvider("waffo") };
});
vi.mock("./providers/stripe", () => ({ stripeProvider: stripe }));
vi.mock("./providers/waffo", () => ({ waffoProvider: waffo }));

const { createCheckout, listOrders, PaymentsDisabledError, UnknownPackError } =
  await import("./orders");
const { handleWebhook, UnknownOrderError, UnknownProviderError } = await import("./webhook");

vi.mock("@/server/analytics", () => ({ capture: vi.fn(async () => {}) }));

let userId: string;
let startBalance: number;

beforeEach(async () => {
  vi.mocked(capture).mockClear();
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Buyer" },
    { method: "admin" },
  );
  userId = user.id;
  // Includes the signup grant.
  startBalance = await getBalance(userId);
});

afterEach(() => {
  vi.unstubAllEnvs();
  stripe.createCheckout.mockClear();
  waffo.createCheckout.mockClear();
});

function checkout(packId = "small") {
  return createCheckout({
    userId,
    email: "buyer@example.com",
    packId,
    locale: "en",
    successUrl: "http://localhost:3000/en/billing?checkout=success",
    cancelUrl: "http://localhost:3000/en/billing?checkout=cancel",
  });
}

function webhook(provider: string, event: Omit<OrderEvent, "kind"> | null) {
  return handleWebhook(provider, JSON.stringify(event && { kind: "order", ...event }), new Headers());
}

// Credits bought since the user signed up.
async function earned() {
  return (await getBalance(userId)) - startBalance;
}

async function onlyOrder() {
  const rows = await getDb().select().from(order).where(eq(order.userId, userId));
  expect(rows).toHaveLength(1);
  return rows[0];
}

test("records a pending order with the active provider's session", async () => {
  const url = await checkout("small");

  expect(url).toBe("https://stripe.test/checkout");
  const row = await onlyOrder();
  expect(row).toMatchObject({
    packId: "small",
    credits: 100,
    amount: 500,
    currency: "usd",
    status: "pending",
    provider: "stripe",
  });
  expect(stripe.createCheckout).toHaveBeenCalledWith(
    expect.objectContaining({ orderId: row.id, email: "buyer@example.com", locale: "en" }),
  );
});

test("PAYMENT_PROVIDER picks the provider for new checkouts", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "waffo");

  expect(await checkout()).toBe("https://waffo.test/checkout");
  expect((await onlyOrder()).provider).toBe("waffo");
  expect(stripe.createCheckout).not.toHaveBeenCalled();
});

test("a paid event marks the order paid and grants its credits once", async () => {
  await checkout("small");
  const { id } = await onlyOrder();

  await webhook("stripe", { orderId: id, outcome: "paid" });
  await webhook("stripe", { orderId: id, outcome: "paid" }); // Providers may repeat events.

  expect(vi.mocked(capture).mock.calls.filter(([event]) => event === "payment_succeeded")).toHaveLength(1);
  expect(capture).toHaveBeenCalledWith("signup_completed", userId);
  expect(await earned()).toBe(100);
  const row = await onlyOrder();
  expect(row.status).toBe("paid");
  expect(row.paidAt).toBeInstanceOf(Date);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "order_paid", data: { orderId: id, credits: 100 } },
  ]);
});

test("a retry after a crash between granting and marking paid grants nothing twice", async () => {
  await checkout("small");
  const { id } = await onlyOrder();
  // The crash: credits granted, order still pending.
  await grantCredits({ userId, amount: 100, reason: "purchase", idempotencyKey: `order:${id}` });

  await webhook("stripe", { orderId: id, outcome: "paid" });

  expect(await earned()).toBe(100);
  expect((await onlyOrder()).status).toBe("paid");
});

test("an order started before a provider switch still completes", async () => {
  await checkout("small");
  const { id } = await onlyOrder();
  vi.stubEnv("PAYMENT_PROVIDER", "waffo");

  await webhook("stripe", { orderId: id, outcome: "paid" });

  expect(await earned()).toBe(100);
});

test("only the provider that took the order can pay it", async () => {
  await checkout("small");
  const { id } = await onlyOrder();

  await expect(webhook("waffo", { orderId: id, outcome: "paid" })).rejects.toBeInstanceOf(UnknownOrderError);

  expect((await onlyOrder()).status).toBe("pending");
  expect(await earned()).toBe(0);
});

test("an expired or failed event closes the order without credits", async () => {
  await checkout("small");
  await checkout("large");
  const [large, small] = await listOrders(userId);

  await webhook("stripe", { orderId: small.id, outcome: "expired" });
  await webhook("stripe", { orderId: large.id, outcome: "failed" });

  expect((await listOrders(userId)).map((o) => o.status)).toEqual(["failed", "expired"]);
  expect(await earned()).toBe(0);
  expect((await pageNotifications(userId)).total).toBe(0);
});

test("a late expiry never undoes a paid order", async () => {
  await checkout("small");
  const { id } = await onlyOrder();

  await webhook("stripe", { orderId: id, outcome: "paid" });
  await webhook("stripe", { orderId: id, outcome: "expired" });

  expect((await onlyOrder()).status).toBe("paid");
  expect(await earned()).toBe(100);
});

test("ignores events that don't change an order, or close an unknown one", async () => {
  await expect(webhook("stripe", null)).resolves.toBeUndefined();
  await expect(webhook("stripe", { orderId: randomUUID(), outcome: "expired" })).resolves.toBeUndefined();
});

// Every order is recorded before its checkout exists, so a payment for an
// unknown order is a bug to retry and look into, not something to drop.
test("rejects a payment for an unknown order, so the provider retries it", async () => {
  await expect(webhook("stripe", { orderId: randomUUID(), outcome: "paid" })).rejects.toBeInstanceOf(
    UnknownOrderError,
  );
});

test("records the order before it asks the provider for a checkout", async () => {
  const sessionId = `cs_${randomUUID()}`;
  let recorded: unknown[] = [];
  stripe.createCheckout.mockImplementationOnce(async ({ orderId }) => {
    recorded = await getDb().select().from(order).where(eq(order.id, orderId));
    return { sessionId, url: "https://stripe.test/checkout" };
  });

  await checkout("small");

  expect(recorded).toMatchObject([{ status: "pending", providerSessionId: null }]);
  expect(await onlyOrder()).toMatchObject({ status: "pending", providerSessionId: sessionId });
});

test("a checkout the provider refuses leaves a failed order, which a payment still completes", async () => {
  stripe.createCheckout.mockRejectedValueOnce(new Error("Stripe 500"));

  await expect(checkout("small")).rejects.toThrow("Stripe 500");
  const { id, status } = await onlyOrder();
  expect(status).toBe("failed");

  // The provider may have opened the checkout before the error reached us.
  await webhook("stripe", { orderId: id, outcome: "paid" });
  expect((await onlyOrder()).status).toBe("paid");
  expect(await earned()).toBe(100);
});

test("rejects webhooks for an unknown provider", async () => {
  await expect(webhook("paypal", null)).rejects.toBeInstanceOf(UnknownProviderError);
});

test("lists a user's orders, newest first", async () => {
  await checkout("small");
  await checkout("large");

  expect((await listOrders(userId)).map((o) => o.credits)).toEqual([1000, 100]);
});

// The billing page sends the list to the browser: only what its table shows.
test("lists only the columns the billing table shows", async () => {
  await checkout("small");

  const [listed] = await listOrders(userId);
  expect(Object.keys(listed).sort()).toEqual(["amount", "createdAt", "credits", "currency", "id", "status"]);
});

test("lists at most the newest orders it's asked for", async () => {
  for (const pack of ["small", "medium", "large"]) await checkout(pack);

  expect((await listOrders(userId, { limit: 2 })).map((o) => o.credits)).toEqual([1000, 450]);
});

test("rejects an unknown pack without calling the provider", async () => {
  await expect(checkout("huge")).rejects.toBeInstanceOf(UnknownPackError);
  expect(stripe.createCheckout).not.toHaveBeenCalled();
});

test("refuses to check out when PAYMENT_PROVIDER is unset", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "");

  await expect(checkout()).rejects.toBeInstanceOf(PaymentsDisabledError);
  expect(await listOrders(userId)).toEqual([]);
});

test("deleting the user removes their orders and credits", async () => {
  await checkout("small");
  const { id } = await onlyOrder();
  await webhook("stripe", { orderId: id, outcome: "paid" });

  await (await auth.$context).internalAdapter.deleteUser(userId);

  expect(await listOrders(userId)).toEqual([]);
  expect(await getBalance(userId)).toBe(0);
});
