// @vitest-environment node
import Stripe from "stripe";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebhookSignatureError } from "./types";

const createSession = vi.fn();
const createPortalSession = vi.fn();
const listSessions = vi.fn();
const listInvoicePayments = vi.fn();
vi.mock("stripe", async (importOriginal) => {
  const { default: Real } = await importOriginal<typeof import("stripe")>();
  const Fake = vi.fn(function () {
    return {
      checkout: { sessions: { create: createSession, list: listSessions } },
      billingPortal: { sessions: { create: createPortalSession } },
      invoicePayments: { list: listInvoicePayments },
    };
  });
  return { default: Object.assign(Fake, { webhooks: Real.webhooks }) };
});

const { stripeProvider } = await import("./stripe");

const secret = "whsec_test";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
});

afterEach(() => {
  vi.unstubAllEnvs();
  createSession.mockReset();
  createPortalSession.mockReset();
  listSessions.mockReset();
  listInvoicePayments.mockReset();
});

function signed(type: string, object: object, key = secret, previous?: object) {
  const payload = JSON.stringify({
    id: "evt_1",
    object: "event",
    type,
    data: { object, ...(previous && { previous_attributes: previous }) },
  });
  const headers = new Headers({
    "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: key }),
  });
  return [payload, headers] as const;
}

const parse = (type: string, object: object) => stripeProvider.parseWebhook(...signed(type, object));

const base = {
  userId: "user-1",
  email: "ada@example.com",
  locale: "en",
  successUrl: "https://app.test/en/billing?checkout=success",
  cancelUrl: "https://app.test/en/billing?checkout=cancel",
};

test("creates a Checkout Session priced from the pack", async () => {
  createSession.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });

  const session = await stripeProvider.createCheckout({
    ...base,
    orderId: "order-1",
    pack: { id: "small", credits: 100, amount: 500, currency: "usd" },
  });

  expect(session).toEqual({ sessionId: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
  expect(createSession).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "payment",
      client_reference_id: "order-1",
      customer_email: "ada@example.com",
      line_items: [
        expect.objectContaining({
          quantity: 1,
          price_data: expect.objectContaining({ currency: "usd", unit_amount: 500 }),
        }),
      ],
      success_url: base.successUrl,
      cancel_url: base.cancelUrl,
    }),
    { idempotencyKey: "order-1" },
  );
});

test("creates a monthly subscription Checkout Session tagged with our subscription ID", async () => {
  createSession.mockResolvedValue({ id: "cs_2", url: "https://checkout.stripe.com/c/pay/cs_2" });

  const session = await stripeProvider.createSubscriptionCheckout({
    ...base,
    subscriptionId: "sub-1",
    expiresAt: new Date("2026-10-12T00:31:00Z"),
    plan: { id: "pro", interval: "month", credits: 300, amount: 1000, currency: "usd" },
  });

  expect(session).toEqual({ sessionId: "cs_2", url: "https://checkout.stripe.com/c/pay/cs_2" });
  expect(createSession).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "subscription",
      client_reference_id: "sub-1",
      customer_email: "ada@example.com",
      line_items: [
        expect.objectContaining({
          price_data: expect.objectContaining({
            currency: "usd",
            unit_amount: 1000,
            recurring: { interval: "month" },
          }),
        }),
      ],
      subscription_data: { metadata: { subscriptionId: "sub-1" } },
      expires_at: Date.parse("2026-10-12T00:31:00Z") / 1000,
    }),
    { idempotencyKey: "sub-1" },
  );
});

test("bills a yearly plan once a year at its yearly price", async () => {
  createSession.mockResolvedValue({ id: "cs_3", url: "https://checkout.stripe.com/c/pay/cs_3" });

  await stripeProvider.createSubscriptionCheckout({
    ...base,
    subscriptionId: "sub-2",
    expiresAt: new Date("2026-10-12T00:31:00Z"),
    plan: { id: "pro-yearly", interval: "year", credits: 250, amount: 10000, currency: "usd" },
  });

  expect(createSession).toHaveBeenCalledWith(
    expect.objectContaining({
      line_items: [
        expect.objectContaining({
          price_data: expect.objectContaining({
            unit_amount: 10000,
            recurring: { interval: "year" },
            product_data: { name: "250 credits per month, billed yearly" },
          }),
        }),
      ],
    }),
    { idempotencyKey: "sub-2" },
  );
});

test("opens the billing portal for the Stripe customer", async () => {
  createPortalSession.mockResolvedValue({ url: "https://billing.stripe.com/p/session/1" });

  const url = await stripeProvider.createPortalLink({
    userId: "user-1",
    providerCustomerId: "cus_1",
    returnUrl: "https://app.test/en/billing",
  });

  expect(url).toBe("https://billing.stripe.com/p/session/1");
  expect(createPortalSession).toHaveBeenCalledWith({
    customer: "cus_1",
    return_url: "https://app.test/en/billing",
  });
});

test("sells packs and monthly and yearly subscriptions with STRIPE_SECRET_KEY alone", () => {
  expect(stripeProvider.configured("packs")).toBe(true);
  expect(stripeProvider.configured("subscriptions")).toBe(true);
  expect(stripeProvider.configured("yearly")).toBe(true);
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  expect(stripeProvider.configured("packs")).toBe(false);
  expect(stripeProvider.configured("subscriptions")).toBe(false);
});

test("a paid one-time Checkout Session pays the order", async () => {
  expect(
    await parse("checkout.session.completed", {
      mode: "payment",
      client_reference_id: "order-1",
      payment_status: "paid",
    }),
  ).toEqual({ kind: "order", orderId: "order-1", outcome: "paid" });
});

test("a completed but unpaid session waits for async_payment_succeeded", async () => {
  expect(
    await parse("checkout.session.completed", {
      mode: "payment",
      client_reference_id: "order-1",
      payment_status: "unpaid",
    }),
  ).toBeNull();
  expect(
    await parse("checkout.session.async_payment_succeeded", {
      mode: "payment",
      client_reference_id: "order-1",
      payment_status: "paid",
    }),
  ).toEqual({ kind: "order", orderId: "order-1", outcome: "paid" });
});

test("expired and failed one-time sessions close the order", async () => {
  expect(
    await parse("checkout.session.expired", { mode: "payment", client_reference_id: "order-1" }),
  ).toEqual({ kind: "order", orderId: "order-1", outcome: "expired" });
  expect(
    await parse("checkout.session.async_payment_failed", { mode: "payment", client_reference_id: "order-1" }),
  ).toEqual({ kind: "order", orderId: "order-1", outcome: "failed" });
});

test("a completed subscription Checkout Session links the Stripe subscription and customer", async () => {
  expect(
    await parse("checkout.session.completed", {
      mode: "subscription",
      client_reference_id: "sub-1",
      payment_status: "paid",
      subscription: "sub_stripe",
      customer: "cus_1",
    }),
  ).toEqual({
    kind: "subscription",
    subscriptionId: "sub-1",
    providerSubscriptionId: "sub_stripe",
    providerCustomerId: "cus_1",
  });
});

test("an expired subscription Checkout Session expires the subscription", async () => {
  expect(
    await parse("checkout.session.expired", { mode: "subscription", client_reference_id: "sub-1" }),
  ).toEqual({ kind: "subscription", subscriptionId: "sub-1", status: "expired" });
});

test("a paid subscription invoice is a charge for the subscription", async () => {
  expect(
    await parse("invoice.paid", {
      id: "in_1",
      customer: "cus_1",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_stripe", metadata: { subscriptionId: "sub-1" } },
      },
    }),
  ).toEqual({
    kind: "subscription",
    subscriptionId: "sub-1",
    providerSubscriptionId: "sub_stripe",
    providerCustomerId: "cus_1",
    paymentId: "in_1",
  });
});

test("ignores invoices that aren't for one of our subscriptions", async () => {
  expect(await parse("invoice.paid", { id: "in_1", customer: "cus_1", parent: null })).toBeNull();
});

test.each([
  [{ status: "active", cancel_at_period_end: false, cancel_at: null }, "active"],
  [{ status: "trialing", cancel_at_period_end: false, cancel_at: null }, "active"],
  [{ status: "active", cancel_at_period_end: true, cancel_at: null }, "canceling"],
  [{ status: "active", cancel_at_period_end: false, cancel_at: 1793000000 }, "canceling"],
  [{ status: "past_due", cancel_at_period_end: false, cancel_at: null }, "past_due"],
  [{ status: "unpaid", cancel_at_period_end: false, cancel_at: null }, "past_due"],
  [{ status: "canceled", cancel_at_period_end: false, cancel_at: null }, "canceled"],
  [{ status: "incomplete_expired", cancel_at_period_end: false, cancel_at: null }, "canceled"],
  [{ status: "incomplete", cancel_at_period_end: false, cancel_at: null }, undefined],
] as const)("maps Stripe subscription %o to %s", async (fields, status) => {
  const event = await parse("customer.subscription.updated", {
    id: "sub_stripe",
    customer: "cus_1",
    metadata: { subscriptionId: "sub-1" },
    items: { data: [{ current_period_end: 1793000000 }] },
    ...fields,
  });

  expect(event).toEqual({
    kind: "subscription",
    subscriptionId: "sub-1",
    providerSubscriptionId: "sub_stripe",
    providerCustomerId: "cus_1",
    status,
    currentPeriodEnd: new Date(1793000000 * 1000),
  });
});

test("a deleted Stripe subscription is canceled", async () => {
  expect(
    await parse("customer.subscription.deleted", {
      id: "sub_stripe",
      customer: "cus_1",
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: { subscriptionId: "sub-1" },
      items: { data: [{ current_period_end: 1793000000 }] },
    }),
  ).toMatchObject({ kind: "subscription", subscriptionId: "sub-1", status: "canceled" });
});

test("ignores subscriptions that weren't started here", async () => {
  expect(
    await parse("customer.subscription.updated", {
      id: "sub_other",
      customer: "cus_1",
      status: "active",
      metadata: {},
      items: { data: [] },
    }),
  ).toBeNull();
});

// A pack's charge belongs to a one-time Checkout Session.
function packCharge() {
  listSessions.mockResolvedValue({ data: [{ mode: "payment", client_reference_id: "order-1" }] });
  listInvoicePayments.mockResolvedValue({ data: [] });
}

// A subscription's charge pays an invoice, not a Checkout Session.
function subscriptionCharge() {
  listSessions.mockResolvedValue({ data: [] });
  listInvoicePayments.mockResolvedValue({
    data: [{ invoice: { id: "in_1", parent: { subscription_details: { metadata: { subscriptionId: "sub-1" } } } } }],
  });
}

test("a refunded pack charge is a refund of the order, by the amount this refund added", async () => {
  packCharge();
  const event = await stripeProvider.parseWebhook(
    ...signed(
      "charge.refunded",
      { id: "ch_1", payment_intent: "pi_1", amount: 500, amount_refunded: 300 },
      secret,
      { amount_refunded: 100 },
    ),
  );

  expect(event).toEqual({ kind: "refund", refundId: "evt_1", target: { orderId: "order-1" }, refunded: 200, charged: 500 });
  expect(listSessions).toHaveBeenCalledWith({ payment_intent: "pi_1", limit: 1 });
});

test("a refunded subscription charge is a refund of the subscription", async () => {
  subscriptionCharge();

  expect(
    await parse("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount: 1000, amount_refunded: 1000 }),
  ).toEqual({ kind: "refund", refundId: "evt_1", target: { subscriptionId: "sub-1" }, refunded: 1000, charged: 1000 });
  expect(listInvoicePayments).toHaveBeenCalledWith({
    payment: { type: "payment_intent", payment_intent: "pi_1" },
    limit: 1,
    expand: ["data.invoice"],
  });
});

test("a chargeback whose funds left the account counts as a refund of the disputed amount", async () => {
  packCharge();

  expect(
    await parse("charge.dispute.funds_withdrawn", { id: "dp_1", payment_intent: "pi_1", amount: 500 }),
  ).toEqual({ kind: "refund", refundId: "evt_1", target: { orderId: "order-1" }, refunded: 500, charged: 500 });
});

test("ignores refunds of charges that aren't ours", async () => {
  listSessions.mockResolvedValue({ data: [] });
  listInvoicePayments.mockResolvedValue({ data: [{ invoice: { id: "in_1", parent: null } }] });

  expect(await parse("charge.refunded", { id: "ch_1", payment_intent: "pi_1", amount: 500, amount_refunded: 500 })).toBeNull();
  expect(await parse("charge.refunded", { id: "ch_2", payment_intent: null, amount: 500, amount_refunded: 500 })).toBeNull();
});

test("ignores other events", async () => {
  expect(await parse("customer.created", {})).toBeNull();
});

test("rejects a payload signed with another secret", async () => {
  await expect(
    stripeProvider.parseWebhook(...signed("checkout.session.completed", {}, "whsec_other")),
  ).rejects.toThrow(WebhookSignatureError);
});

test("rejects a missing signature", async () => {
  const [payload] = signed("checkout.session.completed", {});
  await expect(stripeProvider.parseWebhook(payload, new Headers())).rejects.toThrow(WebhookSignatureError);
});

test("rejects every webhook when STRIPE_WEBHOOK_SECRET is not set", async () => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  await expect(
    stripeProvider.parseWebhook(...signed("checkout.session.completed", {}, "")),
  ).rejects.toThrow(WebhookSignatureError);
});
