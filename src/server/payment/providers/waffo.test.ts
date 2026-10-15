// @vitest-environment node
import { createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebhookSignatureError } from "./types";

const createSession = vi.fn();
const createAuthenticated = vi.fn();
const createPortalLink = vi.fn();
vi.mock("@waffo/pancake-ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("@waffo/pancake-ts")>();
  return {
    ...real,
    WaffoPancake: vi.fn(function () {
      return {
        checkout: { createSession, authenticated: { create: createAuthenticated } },
        auth: { createCustomerPortalLink: createPortalLink },
      };
    }),
  };
});

const { waffoProvider } = await import("./waffo");
const { findPack } = await import("../packs");

// Stands in for Waffo's webhook key pair; the SDK reads the public key from
// WAFFO_WEBHOOK_PUBLIC_KEY before its built-in keys.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

beforeEach(() => {
  vi.stubEnv("WAFFO_MERCHANT_ID", "MER_test");
  vi.stubEnv("WAFFO_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\\nunused\\n-----END PRIVATE KEY-----");
  vi.stubEnv("WAFFO_PACK_SMALL_PRODUCT_ID", "PROD_small");
  vi.stubEnv("WAFFO_PACK_MEDIUM_PRODUCT_ID", "PROD_medium");
  vi.stubEnv("WAFFO_PACK_LARGE_PRODUCT_ID", "PROD_large");
  vi.stubEnv("WAFFO_SUBSCRIPTION_PRODUCT_ID", "PROD_pro");
  vi.stubEnv("WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID", "PROD_pro_yearly");
  vi.stubEnv("WAFFO_STORE_ID", "STO_1");
  vi.stubEnv("WAFFO_ENVIRONMENT", "test");
  vi.stubEnv("WAFFO_WEBHOOK_PUBLIC_KEY", publicKey.export({ type: "spki", format: "pem" }).toString());
});

afterEach(() => {
  vi.unstubAllEnvs();
  createSession.mockReset();
  createAuthenticated.mockReset();
  createPortalLink.mockReset();
});

const parse = (eventType: string, data: object) => waffoProvider.parseWebhook(...signed(eventType, data));

// Signs like Waffo: RSA-SHA256 over "<t>.<body>", sent as "t=<t>,v1=<base64>".
function signed(eventType: string, data: object, mode = "test") {
  const payload = JSON.stringify({
    id: "evt-1",
    timestamp: new Date().toISOString(),
    eventType,
    eventId: "PAY_1",
    storeId: "STO_1",
    storeName: "Test",
    mode,
    data,
  });
  const t = Date.now();
  const v1 = createSign("RSA-SHA256").update(`${t}.${payload}`).sign(privateKey, "base64");
  return [payload, new Headers({ "x-waffo-signature": `t=${t},v1=${v1}` })] as const;
}

test("creates a checkout session for the pack's own product, priced from the pack", async () => {
  createSession.mockResolvedValue({
    sessionId: "cs_1",
    checkoutUrl: "https://pancake.waffo.ai/store/s/checkout/cs_1",
    expiresAt: "2026-10-12T00:00:00Z",
  });

  const session = await waffoProvider.createCheckout({
    userId: "user-1",
    orderId: "order-1",
    pack: { id: "small", credits: 100, amount: 500, currency: "usd" },
    email: "ada@example.com",
    locale: "zh",
    successUrl: "https://app.test/zh/billing?checkout=success",
    cancelUrl: "https://app.test/zh/billing?checkout=cancel",
  });

  expect(session).toEqual({ sessionId: "cs_1", url: "https://pancake.waffo.ai/store/s/checkout/cs_1" });
  expect(createSession).toHaveBeenCalledWith(
    expect.objectContaining({
      productId: "PROD_small",
      currency: "USD",
      priceSnapshot: expect.objectContaining({ amount: "5.00" }),
      buyerEmail: "ada@example.com",
      orderMerchantExternalId: "order-1",
      successUrl: "https://app.test/zh/billing?checkout=success",
      language: "zh-Hans",
    }),
    { idempotencyKey: "order-1" },
  );
});

test("each pack sells as its own product", async () => {
  createSession.mockResolvedValue({ sessionId: "cs_1", checkoutUrl: "https://pancake.waffo.ai/c", expiresAt: "" });

  for (const [pack, productId] of [["medium", "PROD_medium"], ["large", "PROD_large"]] as const) {
    await waffoProvider.createCheckout({
      userId: "user-1",
      orderId: `order-${pack}`,
      pack: { ...findPack(pack)! },
      email: "ada@example.com",
      locale: "en",
      successUrl: "https://app.test/en/billing?checkout=success",
      cancelUrl: "https://app.test/en/billing?checkout=cancel",
    });

    expect(createSession).toHaveBeenLastCalledWith(expect.objectContaining({ productId }), {
      idempotencyKey: `order-${pack}`,
    });
  }
});

test("packs need merchant ID, private key and every pack's product ID", () => {
  expect(waffoProvider.configured("packs")).toBe(true);
  vi.stubEnv("WAFFO_PACK_LARGE_PRODUCT_ID", "");
  expect(waffoProvider.configured("packs")).toBe(false);
  expect(waffoProvider.configured("subscriptions")).toBe(true);
});

test("subscriptions also need the subscription product and the store ID", () => {
  expect(waffoProvider.configured("subscriptions")).toBe(true);
  vi.stubEnv("WAFFO_STORE_ID", "");
  expect(waffoProvider.configured("subscriptions")).toBe(false);
  vi.stubEnv("WAFFO_STORE_ID", "STO_1");
  vi.stubEnv("WAFFO_SUBSCRIPTION_PRODUCT_ID", "");
  expect(waffoProvider.configured("subscriptions")).toBe(false);
});

test("creates a subscription checkout tied to the user, so the portal finds it", async () => {
  createAuthenticated.mockResolvedValue({
    sessionId: "cs_2",
    checkoutUrl: "https://pancake.waffo.ai/store/s/checkout/cs_2#token=t",
    expiresAt: "2026-10-12T00:00:00Z",
  });

  const session = await waffoProvider.createSubscriptionCheckout({
    userId: "user-1",
    subscriptionId: "sub-1",
    expiresAt: new Date(Date.now() + 31 * 60_000),
    plan: { id: "pro", interval: "month", credits: 300, amount: 1000, currency: "usd" },
    email: "ada@example.com",
    locale: "en",
    successUrl: "https://app.test/en/billing?checkout=success",
    cancelUrl: "https://app.test/en/billing?checkout=cancel",
  });

  expect(session).toEqual({ sessionId: "cs_2", url: "https://pancake.waffo.ai/store/s/checkout/cs_2#token=t" });
  expect(createAuthenticated).toHaveBeenCalledWith(
    expect.objectContaining({
      productId: "PROD_pro",
      currency: "USD",
      priceSnapshot: expect.objectContaining({ amount: "10.00" }),
      buyerIdentity: "user-1",
      buyerEmail: "ada@example.com",
      metadata: { subscriptionId: "sub-1" },
      successUrl: "https://app.test/en/billing?checkout=success",
      language: "en",
      expiresInSeconds: 31 * 60,
    }),
    { idempotencyKey: "sub-1" },
  );
});

test("sells a yearly plan as the yearly product", async () => {
  createAuthenticated.mockResolvedValue({ sessionId: "cs_3", checkoutUrl: "https://pancake.waffo.ai/c/cs_3" });

  await waffoProvider.createSubscriptionCheckout({
    userId: "user-1",
    subscriptionId: "sub-2",
    expiresAt: new Date(Date.now() + 31 * 60_000),
    plan: { id: "pro-yearly", interval: "year", credits: 300, amount: 10800, currency: "usd" },
    email: "ada@example.com",
    locale: "en",
    successUrl: "https://app.test/en/billing?checkout=success",
    cancelUrl: "https://app.test/en/billing?checkout=cancel",
  });

  expect(createAuthenticated).toHaveBeenCalledWith(
    expect.objectContaining({ productId: "PROD_pro_yearly", priceSnapshot: expect.objectContaining({ amount: "108.00" }) }),
    { idempotencyKey: "sub-2" },
  );
});

test("yearly plans also need the yearly product", () => {
  expect(waffoProvider.configured("yearly")).toBe(true);
  vi.stubEnv("WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID", "");
  expect(waffoProvider.configured("yearly")).toBe(false);
  expect(waffoProvider.configured("subscriptions")).toBe(true);
  vi.stubEnv("WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID", "PROD_pro_yearly");
  vi.stubEnv("WAFFO_STORE_ID", "");
  expect(waffoProvider.configured("yearly")).toBe(false);
});

test("opens the store's customer portal for the user", async () => {
  createPortalLink.mockResolvedValue({ portalUrl: "https://pancake.waffo.ai/consumer/portal/store/STO_1#token=t" });

  const url = await waffoProvider.createPortalLink({
    userId: "user-1",
    providerCustomerId: null,
    returnUrl: "https://app.test/en/billing",
  });

  expect(url).toBe("https://pancake.waffo.ai/consumer/portal/store/STO_1#token=t");
  expect(createPortalLink).toHaveBeenCalledWith({ storeId: "STO_1", buyerIdentity: "user-1" });
});

test("a subscription charge grants credits once per payment", async () => {
  expect(
    await parse("subscription.payment_succeeded", {
      orderId: "ORD_1",
      paymentId: "PAY_9",
      orderMetadata: { subscriptionId: "sub-1" },
    }),
  ).toEqual({ kind: "subscription", subscriptionId: "sub-1", providerSubscriptionId: "ORD_1", paymentId: "PAY_9" });
});

test.each([
  ["subscription.activated", "active", "active"],
  ["subscription.renewed", "active", "active"],
  ["subscription.recovered", "active", "active"],
  ["subscription.uncanceled", "active", "active"],
  ["subscription.canceling", "canceling", "canceling"],
  ["subscription.past_due", "past_due", "past_due"],
  ["subscription.canceled", "canceled", "canceled"],
  ["subscription.canceled", "expired", "canceled"],
] as const)("%s with orderStatus %s sets the subscription %s", async (eventType, orderStatus, status) => {
  expect(
    await parse(eventType, {
      orderId: "ORD_1",
      orderStatus,
      currentPeriodEnd: "2026-11-12",
      orderMetadata: { subscriptionId: "sub-1" },
    }),
  ).toEqual({
    kind: "subscription",
    subscriptionId: "sub-1",
    providerSubscriptionId: "ORD_1",
    status,
    currentPeriodEnd: new Date("2026-11-12"),
  });
});

test("ignores subscriptions that weren't started here", async () => {
  expect(await parse("subscription.activated", { orderId: "ORD_1", orderStatus: "active" })).toBeNull();
});

test("order.completed pays the order named by orderMerchantExternalId", async () => {
  const event = await waffoProvider.parseWebhook(
    ...signed("order.completed", { orderId: "ORD_1", orderMerchantExternalId: "order-1" }),
  );

  expect(event).toEqual({ kind: "order", orderId: "order-1", outcome: "paid" });
});

test("ignores orders created outside this app", async () => {
  expect(await waffoProvider.parseWebhook(...signed("order.completed", { orderId: "ORD_1" }))).toBeNull();
});

test("refund.succeeded refunds the order, by the refunded share of what was charged", async () => {
  expect(
    await parse("refund.succeeded", {
      orderId: "ORD_1",
      orderMerchantExternalId: "order-1",
      refundedAmount: "2.00",
      originalChargedAmount: "5.00",
    }),
  ).toEqual({ kind: "refund", refundId: "PAY_1", target: { orderId: "order-1" }, refunded: 2, charged: 5 });
});

test("refund.succeeded for a subscription charge refunds the subscription", async () => {
  expect(
    await parse("refund.succeeded", {
      orderId: "ORD_1",
      orderMetadata: { subscriptionId: "sub-1" },
      refundedAmount: "10.00",
      originalPayment: { total: "10.00", taxAmount: "0.00" },
    }),
  ).toEqual({ kind: "refund", refundId: "PAY_1", target: { subscriptionId: "sub-1" }, refunded: 10, charged: 10 });
});

test("a refund without amounts counts as a full refund", async () => {
  expect(
    await parse("refund.succeeded", { orderId: "ORD_1", orderMerchantExternalId: "order-1" }),
  ).toMatchObject({ refunded: 1, charged: 1 });
});

test("ignores refunds of orders created outside this app, and other events", async () => {
  expect(await parse("refund.succeeded", { orderId: "ORD_1", refundedAmount: "5.00" })).toBeNull();
  expect(await parse("refund.failed", { orderId: "ORD_1", orderMerchantExternalId: "order-1" })).toBeNull();
});

test("rejects an event from the other environment, so test payments never grant real credits", async () => {
  vi.stubEnv("WAFFO_ENVIRONMENT", "prod");

  await expect(
    waffoProvider.parseWebhook(...signed("order.completed", { orderMerchantExternalId: "order-1" }, "test")),
  ).rejects.toThrow(WebhookSignatureError);
});

test("rejects a tampered payload", async () => {
  const [payload, headers] = signed("order.completed", { orderMerchantExternalId: "order-1" });

  await expect(
    waffoProvider.parseWebhook(payload.replace("order-1", "order-2"), headers),
  ).rejects.toThrow(WebhookSignatureError);
});

test("rejects a missing signature", async () => {
  const [payload] = signed("order.completed", { orderMerchantExternalId: "order-1" });

  await expect(waffoProvider.parseWebhook(payload, new Headers())).rejects.toThrow(WebhookSignatureError);
});
