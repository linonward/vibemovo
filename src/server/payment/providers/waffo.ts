import {
  type CashierLanguage,
  TaxCategory,
  verifyWebhook,
  WaffoPancake,
  type WebhookEventData,
  WebhookEventType,
} from "@waffo/pancake-ts";
import { requireEnv } from "@/server/env";
import { CREDIT_PACKS, type CreditPack } from "../packs";
import {
  type PaymentEvent,
  type PaymentProvider,
  type RefundEvent,
  type SubscriptionStatus,
  WebhookSignatureError,
} from "./types";

// Waffo cashier languages. Other locales get the English cashier.
const LANGUAGES: Record<string, CashierLanguage> = { en: "en", zh: "zh-Hans" };

// Waffo order statuses for subscriptions, mapped to ours.
const STATUSES: Record<string, SubscriptionStatus> = {
  active: "active",
  canceling: "canceling",
  past_due: "past_due",
  canceled: "canceled",
  expired: "canceled",
  closed: "canceled",
};

const SUBSCRIPTION_EVENTS: string[] = [
  WebhookEventType.SubscriptionActivated,
  WebhookEventType.SubscriptionRenewed,
  WebhookEventType.SubscriptionRecovered,
  WebhookEventType.SubscriptionCanceling,
  WebhookEventType.SubscriptionUncanceled,
  WebhookEventType.SubscriptionPastDue,
  WebhookEventType.SubscriptionCanceled,
];

// Waffo needs the environment its webhooks come from: "test" or "prod".
function environment() {
  return process.env.WAFFO_ENVIRONMENT === "test" ? "test" : "prod";
}

function client() {
  return new WaffoPancake({
    merchantId: requireEnv("WAFFO_MERCHANT_ID"),
    // .env files keep a PEM key on one line with literal "\n".
    privateKey: requireEnv("WAFFO_PRIVATE_KEY").replace(/\\n/g, "\n"),
  });
}

// A display string in major units. Packs and plans use two-decimal currencies.
function price(amount: number) {
  return { amount: (amount / 100).toFixed(2), taxCategory: TaxCategory.SaaS };
}

// A refund names the order or subscription it took money from. Amounts
// are display strings in major units; without them it counts as full.
function refundOf(refundId: string, data: WebhookEventData): RefundEvent | null {
  const orderId = data.orderMerchantExternalId;
  const subscriptionId = data.orderMetadata?.subscriptionId;
  const target = subscriptionId ? { subscriptionId } : orderId ? { orderId } : null;
  if (!target) return null;
  const refunded = Number(data.refundedAmount);
  const charged = Number(data.originalChargedAmount ?? data.originalPayment?.total);
  return refunded > 0 && charged > 0
    ? { kind: "refund", refundId, target, refunded, charged }
    : { kind: "refund", refundId, target, refunded: 1, charged: 1 };
}

// Each credit pack sells as its own dashboard product, so Waffo's orders and
// receipts name the pack. A new pack in CREDIT_PACKS needs a product here.
function packProductId(pack: CreditPack["id"]): string | undefined {
  const ids: Record<CreditPack["id"], string | undefined> = {
    small: process.env.WAFFO_PACK_SMALL_PRODUCT_ID,
    medium: process.env.WAFFO_PACK_MEDIUM_PRODUCT_ID,
    large: process.env.WAFFO_PACK_LARGE_PRODUCT_ID,
  };
  return ids[pack];
}

// Waffo Pancake is a merchant of record: it collects tax and pays out.
// Checkout uses dashboard products (one per pack, see packProductId; the
// monthly WAFFO_SUBSCRIPTION_PRODUCT_ID and yearly
// WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID for plans) and overrides their price. A product sets its billing period.
// Waffo sends no event when a session expires, so abandoned checkouts stay
// pending. Subscriptions carry our ID in the order metadata, which every
// subscription event repeats.
function requirePackProduct(pack: CreditPack["id"]): string {
  const id = packProductId(pack);
  if (!id) throw new Error(`WAFFO_PACK_${pack.toUpperCase()}_PRODUCT_ID is not set`);
  return id;
}

export const waffoProvider: PaymentProvider = {
  id: "waffo",

  configured(feature) {
    const env = process.env;
    if (!env.WAFFO_MERCHANT_ID || !env.WAFFO_PRIVATE_KEY) return false;
    if (feature === "packs") return CREDIT_PACKS.every((pack) => !!packProductId(pack.id));
    const subscriptions = !!(env.WAFFO_SUBSCRIPTION_PRODUCT_ID && env.WAFFO_STORE_ID);
    return feature === "yearly" ? subscriptions && !!env.WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID : subscriptions;
  },

  async createCheckout({ orderId, pack, email, locale, successUrl }) {
    const session = await client().checkout.createSession(
      {
        productId: requirePackProduct(pack.id),
        currency: pack.currency.toUpperCase(),
        priceSnapshot: price(pack.amount),
        buyerEmail: email,
        orderMerchantExternalId: orderId,
        successUrl,
        language: LANGUAGES[locale] ?? "en",
      },
      { idempotencyKey: orderId },
    );
    return { sessionId: session.sessionId, url: session.checkoutUrl };
  },

  async createSubscriptionCheckout({ userId, subscriptionId, plan, email, locale, successUrl, expiresAt }) {
    // Authenticated, so the customer portal lists the subscription under
    // the same buyerIdentity.
    const session = await client().checkout.authenticated.create(
      {
        productId: requireEnv(
          plan.interval === "year" ? "WAFFO_SUBSCRIPTION_YEARLY_PRODUCT_ID" : "WAFFO_SUBSCRIPTION_PRODUCT_ID",
        ),
        currency: plan.currency.toUpperCase(),
        priceSnapshot: price(plan.amount),
        buyerIdentity: userId,
        buyerEmail: email,
        metadata: { subscriptionId },
        successUrl,
        language: LANGUAGES[locale] ?? "en",
        expiresInSeconds: Math.round((expiresAt.getTime() - Date.now()) / 1000),
      },
      { idempotencyKey: subscriptionId },
    );
    return { sessionId: session.sessionId, url: session.checkoutUrl };
  },

  async createPortalLink({ userId }) {
    const link = await client().auth.createCustomerPortalLink({
      storeId: requireEnv("WAFFO_STORE_ID"),
      buyerIdentity: userId,
    });
    return link.portalUrl;
  },

  async parseWebhook(payload, headers): Promise<PaymentEvent | null> {
    const env = environment();
    let event;
    try {
      event = verifyWebhook<WebhookEventData>(payload, headers.get("x-waffo-signature"), {
        environment: env,
      });
    } catch (error) {
      throw new WebhookSignatureError((error as Error).message);
    }
    // Test-mode payments are free; never let them pay a production order.
    if (event.mode !== env) {
      throw new WebhookSignatureError(`Expected a ${env} event, got ${event.mode}`);
    }

    const { data } = event;
    if (event.eventType === WebhookEventType.OrderCompleted) {
      const orderId = data.orderMerchantExternalId;
      return orderId ? { kind: "order", orderId, outcome: "paid" } : null;
    }

    if (event.eventType === WebhookEventType.RefundSucceeded) return refundOf(event.eventId, data);

    const subscriptionId = data.orderMetadata?.subscriptionId;
    if (!subscriptionId) return null;
    const base = { kind: "subscription", subscriptionId, providerSubscriptionId: data.orderId } as const;

    // Fires for the first charge, every renewal and a recovered past-due
    // charge, each with its own payment ID.
    if (event.eventType === WebhookEventType.SubscriptionPaymentSucceeded) {
      return { ...base, paymentId: data.paymentId ?? event.eventId };
    }
    if (SUBSCRIPTION_EVENTS.includes(event.eventType)) {
      return {
        ...base,
        status: data.orderStatus ? STATUSES[data.orderStatus] : undefined,
        currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : undefined,
      };
    }
    return null;
  },
};
