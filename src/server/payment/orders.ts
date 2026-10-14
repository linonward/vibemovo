import { randomUUID } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { grantCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { notify } from "@/server/notifications";
import { findPack } from "./packs";
import { type Feature, getActiveProvider, type ProviderId } from "./providers";
import { order } from "./schema";

export class PaymentsDisabledError extends Error {
  constructor() {
    super("Payments are off: set PAYMENT_PROVIDER and its credentials");
  }
}

export class UnknownPackError extends Error {
  constructor(packId: string) {
    super(`Unknown credit pack: ${packId}`);
  }
}

// A payment for an order that was never recorded. Every order is written
// before its checkout exists, so this is a bug: the webhook fails, and the
// provider retries until someone looks.
export class UnknownOrderError extends Error {
  constructor(orderId: string) {
    super(`Payment for an unknown order: ${orderId}`);
  }
}

export type Order = typeof order.$inferSelect;

export function paymentsEnabled(feature: Feature) {
  return getActiveProvider(feature) !== null;
}

// Records a pending order and starts its checkout with the active
// provider. Returns the URL to send the user to. Credits arrive by webhook.
export async function createCheckout(input: {
  userId: string;
  email: string;
  packId: string;
  locale: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const pack = findPack(input.packId);
  if (!pack) throw new UnknownPackError(input.packId);
  const provider = getActiveProvider("packs");
  if (!provider) throw new PaymentsDisabledError();

  // The order is recorded first, so a payment always finds it. If the
  // provider refuses, the order fails; a payment that arrives anyway still
  // completes it.
  const id = randomUUID();
  const db = getDb();
  await db.insert(order).values({
    id,
    userId: input.userId,
    packId: pack.id,
    credits: pack.credits,
    amount: pack.amount,
    currency: pack.currency,
    provider: provider.id,
  });
  try {
    const { sessionId, url } = await provider.createCheckout({ orderId: id, pack, ...input });
    await db.update(order).set({ providerSessionId: sessionId }).where(eq(order.id, id));
    return url;
  } catch (error) {
    await closeOrder(provider.id, id, "failed");
    throw error;
  }
}

// The user's newest orders, with only what the billing page shows: it
// passes them to the browser.
export function listOrders(userId: string, { limit = 50 }: { limit?: number } = {}) {
  return getDb()
    .select({
      id: order.id,
      credits: order.credits,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      createdAt: order.createdAt,
    })
    .from(order)
    .where(eq(order.userId, userId))
    .orderBy(desc(order.createdAt), desc(order.id))
    .limit(limit);
}

// Only the provider that took an order may change it.
function pendingOrder(provider: ProviderId, orderId: string) {
  return and(eq(order.id, orderId), eq(order.provider, provider), eq(order.status, "pending"));
}

// Grants an unpaid order's credits, marks it paid and notifies the user.
// Money arrived, so a failed or expired order completes too. The
// idempotency keys make a repeated event, or a retry after a crash between
// the steps, grant and notify nothing twice. Throws UnknownOrderError if
// the provider never took this order.
export async function fulfillOrder(provider: ProviderId, orderId: string) {
  const db = getDb();
  const [unpaid] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.provider, provider)));
  if (!unpaid) throw new UnknownOrderError(orderId);
  if (unpaid.status === "paid") return;

  await grantCredits({
    userId: unpaid.userId,
    amount: unpaid.credits,
    reason: "purchase",
    idempotencyKey: `order:${unpaid.id}`,
  });
  await db
    .update(order)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(order.id, orderId), eq(order.provider, provider), ne(order.status, "paid")));
  await notify(unpaid.userId, `order:${unpaid.id}`, {
    type: "order_paid",
    data: { orderId: unpaid.id, credits: unpaid.credits },
  });
}

// Closes a pending order. Paid orders stay paid.
export async function closeOrder(
  provider: ProviderId,
  orderId: string,
  status: "expired" | "failed",
) {
  await getDb().update(order).set({ status }).where(pendingOrder(provider, orderId));
}
