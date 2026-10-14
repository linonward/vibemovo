import { closeOrder, fulfillOrder } from "./orders";
import { getProvider, isProviderId } from "./providers";
import { applyRefund } from "./refunds";
import { applySubscriptionEvent, type Defer } from "./subscriptions";

export { UnknownOrderError } from "./orders";
export { WebhookSignatureError } from "./providers";

export class UnknownProviderError extends Error {}

// Handles a webhook from any provider, active or not, so orders and
// subscriptions started before a PAYMENT_PROVIDER switch keep working.
// Providers retry until this resolves and may repeat an event, so it is
// idempotent.
// Work that needn't hold up the response (emails) goes to `defer`; the
// route passes after(). Without it, the work runs before this resolves.
export async function handleWebhook(
  providerId: string,
  payload: string,
  headers: Headers,
  { defer }: { defer?: Defer } = {},
): Promise<void> {
  if (!isProviderId(providerId)) throw new UnknownProviderError(providerId);
  const event = await getProvider(providerId).parseWebhook(payload, headers);
  if (!event) return;

  if (event.kind === "subscription") await applySubscriptionEvent(providerId, event, defer);
  else if (event.kind === "refund") await applyRefund(providerId, event);
  else if (event.outcome === "paid") await fulfillOrder(providerId, event.orderId);
  else await closeOrder(providerId, event.orderId, event.outcome);
}
