import type { CreditPack } from "../packs";
import type { SubscriptionPlan } from "../plans";

export const PROVIDER_IDS = ["stripe", "waffo"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "canceling",
  "past_due",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

type CheckoutBase = {
  userId: string;
  email: string;
  locale: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutRequest = CheckoutBase & { orderId: string; pack: CreditPack };

export type SubscriptionCheckoutRequest = CheckoutBase & {
  subscriptionId: string;
  plan: SubscriptionPlan;
  // The checkout can't be paid after this.
  expiresAt: Date;
};

// What a webhook means for one of our orders.
export type OrderEvent = {
  kind: "order";
  orderId: string;
  outcome: "paid" | "expired" | "failed";
};

// What a webhook means for one of our subscriptions. Every field but the ID
// is optional: an event carries only what it knows.
export type SubscriptionEvent = {
  kind: "subscription";
  subscriptionId: string;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date;
  // Set when a charge succeeded: the provider's ID for that charge. Each
  // one grants the plan's credits once.
  paymentId?: string;
};

// A refund, or a chargeback whose funds left the account, of one charge
// for an order or a subscription. `refunded` and `charged` share a unit;
// only their ratio matters.
export type RefundEvent = {
  kind: "refund";
  // Unique per refund, so a repeated event takes credits once.
  refundId: string;
  target: { orderId: string } | { subscriptionId: string };
  // This refund alone, not the charge's running total.
  refunded: number;
  // What the charge collected.
  charged: number;
};

export type PaymentEvent = OrderEvent | SubscriptionEvent | RefundEvent;

// "yearly" is selling the yearly plans, on top of "subscriptions".
export type Feature = "packs" | "subscriptions" | "yearly";

export type Checkout = { sessionId: string; url: string };

export interface PaymentProvider {
  id: ProviderId;
  // Whether the settings needed to sell packs or subscriptions are set.
  configured(feature: Feature): boolean;
  createCheckout(request: CheckoutRequest): Promise<Checkout>;
  createSubscriptionCheckout(request: SubscriptionCheckoutRequest): Promise<Checkout>;
  // A page at the provider where the customer cancels, changes the card and
  // downloads invoices.
  createPortalLink(request: {
    userId: string;
    providerCustomerId: string | null;
    returnUrl: string;
  }): Promise<string>;
  // Verifies that the provider sent the raw payload. Returns null for
  // events that change nothing of ours. Async: a refund may need the
  // provider's API to find the charge's order or subscription.
  parseWebhook(payload: string, headers: Headers): Promise<PaymentEvent | null>;
}

export class WebhookSignatureError extends Error {}
