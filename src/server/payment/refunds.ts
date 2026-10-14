import { and, eq } from "drizzle-orm";
import { spendUpTo, usedIdempotencyKeys } from "@/server/credits";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import type { ProviderId, RefundEvent } from "./providers";
import { order, subscription } from "./schema";

// The ledger reason. It doesn't end in " refund", so metrics don't count it
// with the credits a failed job gives back.
export const REFUND_REASON = "refunded payment";

// The paying user and the credits the refunded charge bought. A yearly
// charge pays for twelve months of credits.
async function findCharge(provider: ProviderId, target: RefundEvent["target"]) {
  const db = getDb();
  if ("orderId" in target) {
    const [row] = await db
      .select({ userId: order.userId, credits: order.credits })
      .from(order)
      .where(and(eq(order.id, target.orderId), eq(order.provider, provider), eq(order.status, "paid")));
    return row;
  }
  const [row] = await db
    .select({ userId: subscription.userId, credits: subscription.credits, interval: subscription.interval })
    .from(subscription)
    .where(and(eq(subscription.id, target.subscriptionId), eq(subscription.provider, provider)));
  return row && { userId: row.userId, credits: row.interval === "year" ? row.credits * 12 : row.credits };
}

// Takes back the refunded share of a charge's credits. Credits the user
// already spent can't come back: it takes at most the balance and logs the
// shortfall. Safe to repeat: the key is per refund.
export async function applyRefund(provider: ProviderId, event: RefundEvent): Promise<void> {
  const charge = await findCharge(provider, event.target);
  if (!charge) {
    // Another app on the same account, or a charge this database never saw.
    // Answering 200 stops the provider retrying something that can't match.
    log.warn("payment.refund_unmatched", { provider, refundId: event.refundId, ...event.target });
    return;
  }

  const share = event.charged > 0 ? Math.min(1, event.refunded / event.charged) : 1;
  const owed = Math.round(charge.credits * share);
  const key = `refund:${provider}:${event.refundId}`;
  if (owed <= 0 || (await usedIdempotencyKeys([key])).has(key)) return;

  const taken = await spendUpTo({ userId: charge.userId, amount: owed, reason: REFUND_REASON, idempotencyKey: key });
  if (taken < owed) {
    log.error("payment.refund_shortfall", { provider, userId: charge.userId, ...event.target, owed, taken });
  }
}
