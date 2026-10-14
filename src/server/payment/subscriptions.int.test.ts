import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { log } from "@/server/log";
import { getBalance } from "@/server/credits";
import { getDb } from "@/server/db";
import type { Email } from "@/server/email/client";
import { pageNotifications } from "@/server/notifications";
import { addMonths } from "./periods";
import type { PaymentProvider, SubscriptionEvent } from "./providers";
import { subscription } from "./schema";

// Fake providers: checkout returns a session, and a webhook payload is the
// SubscriptionEvent as JSON. Each provider's own tests cover its API.
const { stripe, waffo } = vi.hoisted(() => {
  const fakeProvider = (id: "stripe" | "waffo") => ({
    id,
    configured: vi.fn<PaymentProvider["configured"]>(() => true),
    createCheckout: vi.fn(),
    createSubscriptionCheckout: vi.fn<PaymentProvider["createSubscriptionCheckout"]>(async () => ({
      sessionId: `cs_${crypto.randomUUID()}`,
      url: `https://${id}.test/subscribe`,
    })),
    createPortalLink: vi.fn<PaymentProvider["createPortalLink"]>(async () => `https://${id}.test/portal`),
    parseWebhook: (payload: string) => JSON.parse(payload, (key, value) =>
      key === "currentPeriodEnd" ? new Date(value) : value,
    ),
  });
  return { stripe: fakeProvider("stripe"), waffo: fakeProvider("waffo") };
});
vi.mock("./providers/stripe", () => ({ stripeProvider: stripe }));
vi.mock("./providers/waffo", () => ({ waffoProvider: waffo }));
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<(email: Email) => Promise<void>>(async () => {}) }));
vi.mock("@/server/email/client", () => ({ sendEmail }));

const {
  AlreadySubscribedError,
  assertNoLiveSubscription,
  CHECKOUT_MINUTES,
  CheckoutPendingError,
  createPortalLink,
  createSubscriptionCheckout,
  getCurrentSubscription,
  grantYearlyMonths,
  LiveSubscriptionError,
  NoSubscriptionError,
  offeredPlans,
  UnknownPlanError,
} = await import("./subscriptions");
const { PaymentsDisabledError } = await import("./orders");
const { handleWebhook } = await import("./webhook");

let userId: string;
let userEmail: string;
let startBalance: number;

beforeEach(async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  // Email links need the site URL, and CI has no .env.
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Subscriber" },
    { method: "admin" },
  );
  userId = user.id;
  userEmail = user.email;
  // Includes the signup grant.
  startBalance = await getBalance(userId);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const provider of [stripe, waffo]) {
    provider.configured.mockImplementation(() => true);
    provider.createSubscriptionCheckout.mockClear();
    provider.createPortalLink.mockClear();
  }
  sendEmail.mockReset();
});

function subscribe(planId = "pro") {
  return createSubscriptionCheckout({
    userId,
    email: "ada@example.com",
    planId,
    locale: "en",
    successUrl: "http://localhost:3000/en/billing?checkout=success",
    cancelUrl: "http://localhost:3000/en/billing?checkout=cancel",
  });
}

function webhook(provider: string, event: Omit<SubscriptionEvent, "kind">) {
  return handleWebhook(provider, JSON.stringify({ kind: "subscription", ...event }), new Headers());
}

// Payment IDs are unique per provider, and so are the grants keyed on them.
const payment = (name: string) => `${name}_${randomUUID()}`;

async function earned() {
  return (await getBalance(userId)) - startBalance;
}

async function onlySubscription() {
  const rows = await getDb().select().from(subscription).where(eq(subscription.userId, userId));
  expect(rows).toHaveLength(1);
  return rows[0];
}

test("records a pending subscription with the active provider's session", async () => {
  expect(await subscribe()).toBe("https://stripe.test/subscribe");

  const row = await onlySubscription();
  expect(row).toMatchObject({
    planId: "pro",
    credits: 300,
    amount: 1000,
    currency: "usd",
    status: "pending",
    provider: "stripe",
  });
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
    expect.objectContaining({ subscriptionId: row.id, userId, email: "ada@example.com" }),
  );
  expect(await getCurrentSubscription(userId)).toBeNull();
});

test("the first charge activates the subscription and grants the plan's credits", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  await webhook("stripe", {
    subscriptionId: id,
    providerSubscriptionId: "sub_stripe",
    providerCustomerId: "cus_1",
    paymentId: payment("in"),
  });

  expect(await earned()).toBe(300);
  expect(await getCurrentSubscription(userId)).toMatchObject({
    id,
    status: "active",
    providerSubscriptionId: "sub_stripe",
    providerCustomerId: "cus_1",
  });
});

test("each paid month grants credits once, and they carry over", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  const first = payment("in");
  await webhook("stripe", { subscriptionId: id, paymentId: first });
  await webhook("stripe", { subscriptionId: id, paymentId: first }); // Repeated event.
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") }); // Next month.

  expect(await earned()).toBe(600);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "subscription_paid", data: { planId: "pro", credits: 300 } },
    { type: "subscription_paid", data: { planId: "pro", credits: 300 } },
  ]);
});

test("notifies once when a charge fails, and once when a live subscription ends", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await webhook("stripe", { subscriptionId: id, status: "past_due" });
  await webhook("stripe", { subscriptionId: id, status: "past_due" }); // Repeated event.
  await webhook("stripe", { subscriptionId: id, status: "canceled" });
  await webhook("stripe", { subscriptionId: id, status: "canceled" });

  expect((await pageNotifications(userId)).notifications.map((n) => n.type)).toEqual([
    "subscription_ended",
    "subscription_past_due",
    "subscription_paid",
  ]);
  expect((await pageNotifications(userId)).notifications[0].data).toEqual({ planId: "pro" });
});

test("emails once when a charge fails, and once when a live subscription ends", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await webhook("stripe", { subscriptionId: id, status: "past_due" });
  await webhook("stripe", { subscriptionId: id, status: "past_due" }); // Repeated event.
  await webhook("stripe", { subscriptionId: id, status: "canceled" });
  await webhook("stripe", { subscriptionId: id, status: "canceled" });

  expect(sendEmail.mock.calls.map(([email]) => [email.to, email.subject])).toEqual([
    [userEmail, expect.stringMatching(/payment didn't go through/)],
    [userEmail, expect.stringMatching(/subscription has ended/)],
  ]);
  for (const [email] of sendEmail.mock.calls) {
    expect(email.text).toContain("https://app.example.com/billing");
  }
});

// The route hands emails to after(), so the provider gets its 200 without
// waiting for Resend.
test("hands the email to the caller's defer, to send after the response", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });
  const deferred: (() => Promise<void>)[] = [];

  await handleWebhook(
    "stripe",
    JSON.stringify({ kind: "subscription", subscriptionId: id, status: "past_due" }),
    new Headers(),
    { defer: (task) => void deferred.push(task) },
  );

  expect((await pageNotifications(userId)).notifications[0].type).toBe("subscription_past_due");
  expect(sendEmail).not.toHaveBeenCalled();
  await Promise.all(deferred.map((task) => task()));
  expect(sendEmail).toHaveBeenCalledTimes(1);
});

test("sends no email for a paid month", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  expect(sendEmail).not.toHaveBeenCalled();
});

test("a failed email is logged and never fails the webhook", async () => {
  const error = vi.spyOn(log, "error").mockImplementation(() => {});
  const down = new Error("Resend: down");
  sendEmail.mockRejectedValue(down);
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await webhook("stripe", { subscriptionId: id, status: "past_due" });

  expect((await getCurrentSubscription(userId))?.status).toBe("past_due");
  expect((await pageNotifications(userId)).notifications[0].type).toBe("subscription_past_due");
  // Resend's error, not an earlier one that kept the email from being sent.
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith("payment.email_failed", { userId, email: "past_due", error: down });
});

test("status events update the status and the period end", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  const periodEnd = new Date("2026-11-12T00:00:00Z");

  await webhook("stripe", { subscriptionId: id, status: "active", currentPeriodEnd: periodEnd });
  await webhook("stripe", { subscriptionId: id, status: "canceling" });

  expect(await onlySubscription()).toMatchObject({ status: "canceling", currentPeriodEnd: periodEnd });
  expect(await getCurrentSubscription(userId)).not.toBeNull();
});

test("canceled is final: a late, older event doesn't revive it", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  await webhook("stripe", { subscriptionId: id, status: "canceled" });
  await webhook("stripe", { subscriptionId: id, status: "active" });

  expect((await onlySubscription()).status).toBe("canceled");
  expect(await getCurrentSubscription(userId)).toBeNull();
});

test("an event for an older period changes neither the status nor the period", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  const december = new Date("2026-12-12T00:00:00Z");
  const november = new Date("2026-11-12T00:00:00Z");

  await webhook("stripe", { subscriptionId: id, status: "active", currentPeriodEnd: december });
  await webhook("stripe", { subscriptionId: id, status: "past_due", currentPeriodEnd: november });

  expect(await onlySubscription()).toMatchObject({ status: "active", currentPeriodEnd: december });
  expect((await pageNotifications(userId)).total).toBe(0);
});

test("events that arrive together can't revive a canceled subscription", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, status: "active" });

  await Promise.all([
    webhook("stripe", { subscriptionId: id, status: "canceled" }),
    webhook("stripe", { subscriptionId: id, status: "active" }),
    webhook("stripe", { subscriptionId: id, status: "active" }),
  ]);

  expect((await onlySubscription()).status).toBe("canceled");
});

test("an abandoned checkout expires only while pending", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, status: "expired" });
  expect((await onlySubscription()).status).toBe("expired");
  // It never started, so it never ended.
  expect((await pageNotifications(userId)).total).toBe(0);

  vi.stubEnv("PAYMENT_PROVIDER", "stripe");
  const other = await createSubscriptionCheckout({
    userId,
    email: "ada@example.com",
    planId: "pro",
    locale: "en",
    successUrl: "https://app.test/s",
    cancelUrl: "https://app.test/c",
  });
  expect(other).toBe("https://stripe.test/subscribe");
});

test("a late expiry never ends a paid subscription", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });
  await webhook("stripe", { subscriptionId: id, status: "expired" });

  expect((await onlySubscription()).status).toBe("active");
});

test("only the provider that took the subscription can change it", async () => {
  await subscribe();
  const { id } = await onlySubscription();

  await webhook("waffo", { subscriptionId: id, paymentId: payment("PAY"), status: "active" });

  expect((await onlySubscription()).status).toBe("pending");
  expect(await earned()).toBe(0);
});

test("a subscription started before a provider switch keeps renewing", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  vi.stubEnv("PAYMENT_PROVIDER", "waffo");

  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  expect(await earned()).toBe(300);
});

test("a live subscription blocks a second checkout", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await expect(subscribe()).rejects.toBeInstanceOf(AlreadySubscribedError);
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(1);
});

// Two open checkouts could both be paid, and the user charged twice a month.
test("an open checkout blocks a second one", async () => {
  await subscribe();

  await expect(subscribe()).rejects.toBeInstanceOf(CheckoutPendingError);
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(1);
  await onlySubscription();
});

test("two checkouts started at once open only one", async () => {
  const results = await Promise.allSettled([subscribe(), subscribe(), subscribe()]);

  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const r of results.filter((r) => r.status === "rejected")) {
    expect(r.reason).toBeInstanceOf(CheckoutPendingError);
  }
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(1);
  await onlySubscription();
});

test("records the subscription before it asks the provider, and a refused checkout blocks nothing", async () => {
  let recorded: unknown[] = [];
  stripe.createSubscriptionCheckout.mockImplementationOnce(async ({ subscriptionId }) => {
    recorded = await getDb().select().from(subscription).where(eq(subscription.id, subscriptionId));
    throw new Error("Stripe 500");
  });

  await expect(subscribe()).rejects.toThrow("Stripe 500");
  expect(recorded).toMatchObject([{ status: "pending", providerSessionId: null }]);
  expect((await onlySubscription()).status).toBe("expired");

  await subscribe();
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
});

test("asks the provider to close the checkout when the block ends", async () => {
  const before = Date.now();
  await subscribe();

  const { expiresAt } = stripe.createSubscriptionCheckout.mock.calls[0][0];
  expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(CHECKOUT_MINUTES * 60_000 - 1_000);
  expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(CHECKOUT_MINUTES * 60_000);
});

test("a new checkout can start once the open one expires", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, status: "expired" });

  await subscribe();
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
});

test("a new checkout can start once the open one is past its expiry", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await getDb()
    .update(subscription)
    .set({ createdAt: sql`now() - make_interval(mins => ${CHECKOUT_MINUTES + 1})` })
    .where(eq(subscription.id, id));

  await subscribe();
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledTimes(2);
});

test("opens the portal of the provider that holds the subscription", async () => {
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, providerCustomerId: "cus_1", paymentId: payment("in") });
  vi.stubEnv("PAYMENT_PROVIDER", "waffo");

  expect(await createPortalLink(userId, "https://app.test/en/billing")).toBe("https://stripe.test/portal");
  expect(stripe.createPortalLink).toHaveBeenCalledWith({
    userId,
    providerCustomerId: "cus_1",
    returnUrl: "https://app.test/en/billing",
  });
});

test("has no portal without a live subscription", async () => {
  await expect(createPortalLink(userId, "https://app.test")).rejects.toBeInstanceOf(NoSubscriptionError);
});

test("a live subscription blocks account deletion until it's canceled", async () => {
  await assertNoLiveSubscription(userId);
  await subscribe();
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await expect(assertNoLiveSubscription(userId)).rejects.toBeInstanceOf(LiveSubscriptionError);

  await webhook("stripe", { subscriptionId: id, status: "canceled" });
  await expect(assertNoLiveSubscription(userId)).resolves.toBeUndefined();
});

test("rejects an unknown plan without calling the provider", async () => {
  await expect(subscribe("enterprise")).rejects.toBeInstanceOf(UnknownPlanError);
  expect(stripe.createSubscriptionCheckout).not.toHaveBeenCalled();
});

test("refuses to subscribe when PAYMENT_PROVIDER is unset", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "");

  await expect(subscribe()).rejects.toBeInstanceOf(PaymentsDisabledError);
});

test("records a yearly subscription with its interval and yearly price", async () => {
  await subscribe("pro-yearly");

  expect(await onlySubscription()).toMatchObject({
    planId: "pro-yearly",
    interval: "year",
    credits: 250,
    amount: 10000,
    status: "pending",
  });
  expect(stripe.createSubscriptionCheckout).toHaveBeenCalledWith(
    expect.objectContaining({ plan: expect.objectContaining({ id: "pro-yearly", interval: "year" }) }),
  );
});

test("offers and sells only the plans the active provider can bill", async () => {
  vi.stubEnv("PAYMENT_PROVIDER", "waffo");
  waffo.configured.mockImplementation((feature) => feature !== "yearly");

  expect(offeredPlans().map((plan) => plan.id)).toEqual(["pro"]);
  await expect(subscribe("pro-yearly")).rejects.toBeInstanceOf(PaymentsDisabledError);
  expect(waffo.createSubscriptionCheckout).not.toHaveBeenCalled();
  expect(await subscribe("pro")).toBe("https://waffo.test/subscribe");
});

test("offers every plan with a provider that bills yearly, or while payments are off", () => {
  const all = ["pro", "pro-yearly"];
  expect(offeredPlans().map((plan) => plan.id)).toEqual(all);

  vi.stubEnv("PAYMENT_PROVIDER", "");
  expect(offeredPlans().map((plan) => plan.id)).toEqual(all);
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// A paid yearly subscription whose period started at `start`.
async function yearly(start: Date) {
  await subscribe("pro-yearly");
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });
  await webhook("stripe", { subscriptionId: id, status: "active", currentPeriodEnd: addMonths(start, 12) });
  return id;
}

async function notificationTypes() {
  return (await pageNotifications(userId)).notifications.map((n) => n.type);
}

test("the sweep grants each month of a yearly plan that has begun, once", async () => {
  await yearly(daysAgo(100)); // Months 2, 3 and 4 have begun.

  await grantYearlyMonths();
  await grantYearlyMonths(); // A repeated or concurrent run.

  expect(await earned()).toBe(1000);
  expect(await notificationTypes()).toEqual(["credits_added", "credits_added", "credits_added", "subscription_paid"]);
  expect((await pageNotifications(userId)).notifications[0].data).toEqual({ credits: 250 });
});

test("a later run grants only the months begun since", async () => {
  await yearly(daysAgo(20));

  await grantYearlyMonths();
  expect(await earned()).toBe(250);

  await grantYearlyMonths(new Date(Date.now() + 15 * DAY));
  expect(await earned()).toBe(500);
});

test("grants nothing while the payment is past due or after the subscription ends", async () => {
  const id = await yearly(daysAgo(100));
  await webhook("stripe", { subscriptionId: id, status: "past_due" });

  await grantYearlyMonths();
  expect(await earned()).toBe(250);

  await webhook("stripe", { subscriptionId: id, status: "canceled" });
  await grantYearlyMonths();
  expect(await earned()).toBe(250);
});

test("a canceling subscription keeps the months it paid for", async () => {
  const id = await yearly(daysAgo(40));
  await webhook("stripe", { subscriptionId: id, status: "canceling" });

  await grantYearlyMonths();

  expect(await earned()).toBe(500);
});

test("a renewal starts the months again from the new period", async () => {
  const start = daysAgo(400);
  const id = await yearly(start);
  await grantYearlyMonths();
  expect(await earned()).toBe(3000);

  // The renewal charge grants the new period's first month.
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in"), currentPeriodEnd: addMonths(start, 24) });
  await grantYearlyMonths();

  expect(await earned()).toBe(3500); // The new period's second month began 4 days ago.
});

test("monthly plans get nothing from the sweep", async () => {
  await subscribe("pro");
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });
  await webhook("stripe", { subscriptionId: id, status: "active", currentPeriodEnd: addMonths(daysAgo(100), 1) });

  await grantYearlyMonths(new Date(Date.now() + 365 * DAY));

  expect(await earned()).toBe(300);
});

test("without a period end, a yearly subscription waits, and is logged once a day old", async () => {
  const error = vi.spyOn(log, "error");
  await subscribe("pro-yearly");
  const { id } = await onlySubscription();
  await webhook("stripe", { subscriptionId: id, paymentId: payment("in") });

  await grantYearlyMonths();
  expect(await earned()).toBe(250);
  expect(error).not.toHaveBeenCalledWith("subscription.no_period_end", { subscriptionId: id });

  await getDb()
    .update(subscription)
    .set({ createdAt: sql`now() - interval '2 days'` })
    .where(eq(subscription.id, id));
  await grantYearlyMonths();

  expect(await earned()).toBe(250);
  expect(error).toHaveBeenCalledWith("subscription.no_period_end", { subscriptionId: id });
});
