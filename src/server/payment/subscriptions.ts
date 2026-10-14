import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { grantCredits, usedIdempotencyKeys } from "@/server/credits";
import { type Db, getDb, type Tx } from "@/server/db";
import { log } from "@/server/log";
import { notify } from "@/server/notifications";
import { emailSubscriber } from "./emails";
import { PaymentsDisabledError } from "./orders";
import { monthsBegun } from "./periods";
import { findPlan, SUBSCRIPTION_PLANS, type SubscriptionPlan } from "./plans";
import {
  getActiveProvider,
  getProvider,
  type ProviderId,
  type SubscriptionEvent,
  type SubscriptionStatus,
} from "./providers";
import { subscription } from "./schema";

export class UnknownPlanError extends Error {
  constructor(planId: string) {
    super(`Unknown subscription plan: ${planId}`);
  }
}

export class AlreadySubscribedError extends Error {
  constructor() {
    super("The user already has a subscription");
  }
}

export class CheckoutPendingError extends Error {
  constructor() {
    super("The user has an open subscription checkout");
  }
}

export class NoSubscriptionError extends Error {
  constructor() {
    super("The user has no subscription");
  }
}

export class LiveSubscriptionError extends Error {
  constructor() {
    super("Cancel the subscription before deleting the account");
  }
}

export type Subscription = typeof subscription.$inferSelect;

// How long a subscription checkout stays open. While one is open, the user
// can't start another: paying both would charge them twice a month. Stripe
// needs at least 30 minutes; the extra minute covers the request's travel.
export const CHECKOUT_MINUTES = 31;

// Statuses in which the provider may still charge the user.
const LIVE = ["active", "canceling", "past_due"] as const satisfies SubscriptionStatus[];

const DAY = 24 * 60 * 60 * 1000;

// Runs a task now, or hands it on to run later (after() in a route).
export type Defer = (task: () => Promise<void>) => void | Promise<void>;

export type LiveSubscription = Subscription & { status: (typeof LIVE)[number] };

// The user's subscription that is paid for or may still charge, if any.
export async function getCurrentSubscription(
  userId: string,
  db: Db | Tx = getDb(),
): Promise<LiveSubscription | null> {
  const [row] = await db
    .select()
    .from(subscription)
    .where(and(eq(subscription.userId, userId), inArray(subscription.status, LIVE)))
    .orderBy(desc(subscription.createdAt))
    .limit(1);
  return (row as LiveSubscription | undefined) ?? null;
}

// The plans to show. Waffo bills yearly only with a yearly product, so its
// yearly plans hide without one. While payments are off, every plan shows,
// unbuyable.
export function offeredPlans(): SubscriptionPlan[] {
  const provider = getActiveProvider("subscriptions");
  const yearly = !provider || provider.configured("yearly");
  return SUBSCRIPTION_PLANS.filter((plan) => plan.interval === "month" || yearly);
}

// Starts a subscription checkout with the active provider and records a
// pending subscription. Returns the URL to send the user to. Status and
// credits arrive by webhook.
export async function createSubscriptionCheckout(input: {
  userId: string;
  email: string;
  planId: string;
  locale: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const plan = findPlan(input.planId);
  if (!plan) throw new UnknownPlanError(input.planId);
  const provider = getActiveProvider(plan.interval === "year" ? "yearly" : "subscriptions");
  if (!provider) throw new PaymentsDisabledError();

  // Computed before the row exists, so the checkout closes before the block
  // on a new one (createdAt + CHECKOUT_MINUTES) ends.
  const expiresAt = new Date(Date.now() + CHECKOUT_MINUTES * 60_000);
  const id = randomUUID();
  const db = getDb();
  // The row is recorded first, so a payment always finds it. The lock makes
  // checkouts for one user start one at a time, so two at once can't both
  // pass the checks.
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscribe:${input.userId}`}))`);
    if (await getCurrentSubscription(input.userId, tx)) throw new AlreadySubscribedError();
    if (await hasOpenCheckout(input.userId, tx)) throw new CheckoutPendingError();
    await tx.insert(subscription).values({
      id,
      userId: input.userId,
      planId: plan.id,
      interval: plan.interval,
      credits: plan.credits,
      amount: plan.amount,
      currency: plan.currency,
      provider: provider.id,
    });
  });
  try {
    const { sessionId, url } = await provider.createSubscriptionCheckout({
      subscriptionId: id,
      plan,
      expiresAt,
      ...input,
    });
    await db.update(subscription).set({ providerSessionId: sessionId }).where(eq(subscription.id, id));
    return url;
  } catch (error) {
    // The user never got a link, so the checkout mustn't block a retry.
    await db
      .update(subscription)
      .set({ status: "expired" })
      .where(and(eq(subscription.id, id), eq(subscription.status, "pending")));
    throw error;
  }
}

// A pending subscription younger than CHECKOUT_MINUTES. Stripe expires an
// abandoned one sooner by webhook; Waffo sends nothing, so age decides.
async function hasOpenCheckout(userId: string, db: Db | Tx): Promise<boolean> {
  const open = await db.$count(
    subscription,
    and(
      eq(subscription.userId, userId),
      eq(subscription.status, "pending"),
      gt(subscription.createdAt, sql`now() - make_interval(mins => ${CHECKOUT_MINUTES})`),
    ),
  );
  return open > 0;
}

// A link to the portal of the provider holding the current subscription,
// even if PAYMENT_PROVIDER has changed since.
export async function createPortalLink(userId: string, returnUrl: string): Promise<string> {
  const current = await getCurrentSubscription(userId);
  if (!current) throw new NoSubscriptionError();
  return getProvider(current.provider).createPortalLink({
    userId,
    providerCustomerId: current.providerCustomerId,
    returnUrl,
  });
}

// Providers keep charging a live subscription after the account is gone,
// so deletion waits until the user cancels it.
export async function assertNoLiveSubscription(userId: string): Promise<void> {
  if (await getCurrentSubscription(userId)) throw new LiveSubscriptionError();
}

// Providers can deliver events late and out of order, so a status only
// moves where it makes sense.
function nextStatus(current: SubscriptionStatus, event: SubscriptionEvent): SubscriptionStatus {
  if (current === "canceled" || current === "expired") return current;
  if (event.status === "expired") return current === "pending" ? "expired" : current;
  if (event.status) return event.status;
  // The first charge can arrive before the status event.
  if (event.paymentId && current === "pending") return "active";
  return current;
}

// Applies a webhook to a subscription the provider took. Safe to repeat.
export async function applySubscriptionEvent(
  provider: ProviderId,
  event: SubscriptionEvent,
  defer: Defer = (task) => task(),
) {
  const db = getDb();
  const where = and(eq(subscription.id, event.subscriptionId), eq(subscription.provider, provider));
  const [current] = await db.select().from(subscription).where(where);
  if (!current) return;

  // A charge happened, whatever the status: grant once per payment.
  if (event.paymentId) {
    const key = `subscription:${provider}:${event.paymentId}`;
    await grantCredits({
      userId: current.userId,
      amount: current.credits,
      reason: "subscription",
      idempotencyKey: key,
    });
    await notify(current.userId, key, {
      type: "subscription_paid",
      data: { planId: current.planId, credits: current.credits },
    });
  }

  // Locked, so two events at once apply one after the other. An event for
  // an earlier period than the stored one is stale: it changes neither.
  const previous = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(subscription).where(where).for("update");
    const stale = Boolean(
      event.currentPeriodEnd && locked.currentPeriodEnd && event.currentPeriodEnd < locked.currentPeriodEnd,
    );
    await tx
      .update(subscription)
      .set({
        status: stale ? locked.status : nextStatus(locked.status, event),
        ...(event.providerSubscriptionId && { providerSubscriptionId: event.providerSubscriptionId }),
        ...(event.providerCustomerId && { providerCustomerId: event.providerCustomerId }),
        ...(!stale && event.currentPeriodEnd && { currentPeriodEnd: event.currentPeriodEnd }),
      })
      .where(where);
    return { status: locked.status, stale };
  });
  if (previous.stale) return;
  const status = nextStatus(previous.status, event);

  // Status changes the user should act on or know about. A checkout that
  // never started has nothing to end.
  const data = { planId: current.planId };
  if (status === "past_due" && previous.status !== "past_due") {
    // One per billing period: the next period's failure notifies again.
    const period = (event.currentPeriodEnd ?? current.currentPeriodEnd)?.toISOString() ?? "none";
    const key = `subscription:${current.id}:past_due:${period}`;
    if (await notify(current.userId, key, { type: "subscription_past_due", data })) {
      await defer(() => emailSubscriber(current.userId, "past_due"));
    }
  }
  if ((status === "canceled" || status === "expired") && isLive(previous.status)) {
    const key = `subscription:${current.id}:ended`;
    if (await notify(current.userId, key, { type: "subscription_ended", data })) {
      await defer(() => emailSubscriber(current.userId, "ended"));
    }
  }
}

function isLive(status: SubscriptionStatus): boolean {
  return (LIVE as readonly SubscriptionStatus[]).includes(status);
}

// Grants yearly plans their monthly credits as each month begins: the
// charge grants a period's first month, this the other eleven. Months come
// from the period end, so a missed run catches up and a renewal starts
// again. Only paid-for subscriptions get them; one that is past due or
// ended gets none. The sweep calls this; safe to run at any interval and
// concurrently. Returns the number of months granted.
export async function grantYearlyMonths(now = new Date()): Promise<number> {
  const rows = await getDb()
    .select()
    .from(subscription)
    .where(and(eq(subscription.interval, "year"), inArray(subscription.status, ["active", "canceling"])));

  const due: { row: Subscription; key: string }[] = [];
  for (const row of rows) {
    if (!row.currentPeriodEnd) {
      // The period event usually follows the charge within seconds.
      if (now.getTime() - row.createdAt.getTime() > DAY) {
        log.error("subscription.no_period_end", { subscriptionId: row.id });
      }
      continue;
    }
    const period = row.currentPeriodEnd.toISOString();
    for (const month of monthsBegun(row.currentPeriodEnd, now)) {
      due.push({ row, key: `subscription:${row.id}:${period}:m${month}` });
    }
  }

  const used = await usedIdempotencyKeys(due.map(({ key }) => key));
  let granted = 0;
  for (const { row, key } of due) {
    if (used.has(key)) continue;
    await grantCredits({ userId: row.userId, amount: row.credits, reason: "subscription", idempotencyKey: key });
    await notify(row.userId, key, { type: "credits_added", data: { credits: row.credits } });
    granted++;
  }
  return granted;
}
