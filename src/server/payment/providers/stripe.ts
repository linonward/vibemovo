import Stripe from "stripe";
import { requireEnv } from "@/server/env";
import {
  type PaymentEvent,
  type PaymentProvider,
  type RefundEvent,
  type SubscriptionStatus,
  WebhookSignatureError,
} from "./types";

function client() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"));
}

// Expandable fields arrive as IDs in webhooks; take the ID either way.
function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function subscriptionStatus(subscription: Stripe.Subscription): SubscriptionStatus | undefined {
  switch (subscription.status) {
    case "active":
    case "trialing":
      return subscription.cancel_at_period_end || subscription.cancel_at ? "canceling" : "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      // incomplete, paused: the first invoice or a resume decides.
      return undefined;
  }
}

// Charges carry no order or subscription ID. A pack's payment intent
// belongs to its Checkout Session; a subscription's pays an invoice, whose
// metadata names the subscription. Null for a charge that isn't ours.
async function refundTarget(paymentIntent: string | null): Promise<RefundEvent["target"] | null> {
  if (!paymentIntent) return null;
  const stripe = client();
  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
  const orderId = sessions.data[0]?.mode === "payment" ? sessions.data[0].client_reference_id : null;
  if (orderId) return { orderId };

  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntent },
    limit: 1,
    expand: ["data.invoice"],
  });
  const invoice = payments.data[0]?.invoice;
  const subscriptionId =
    invoice && typeof invoice !== "string" && "parent" in invoice
      ? invoice.parent?.subscription_details?.metadata?.subscriptionId
      : undefined;
  return subscriptionId ? { subscriptionId } : null;
}

// Checkout prices packs and plans inline, so Stripe needs no products or
// prices set up. Subscriptions carry our ID in their metadata, which every
// invoice copies, so renewals find their way back.
export const stripeProvider: PaymentProvider = {
  id: "stripe",

  configured: () => !!process.env.STRIPE_SECRET_KEY,

  async createCheckout({ orderId, pack, email, successUrl, cancelUrl }) {
    const session = await client().checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: orderId,
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: pack.currency,
              unit_amount: pack.amount,
              product_data: { name: `${pack.credits} credits` },
            },
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { idempotencyKey: orderId },
    );
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
    return { sessionId: session.id, url: session.url };
  },

  async createSubscriptionCheckout({ subscriptionId, plan, email, successUrl, cancelUrl, expiresAt }) {
    const session = await client().checkout.sessions.create(
      {
        mode: "subscription",
        client_reference_id: subscriptionId,
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: plan.currency,
              unit_amount: plan.amount,
              recurring: { interval: plan.interval },
              product_data: {
                name: `${plan.credits} credits per month${plan.interval === "year" ? ", billed yearly" : ""}`,
              },
            },
          },
        ],
        subscription_data: { metadata: { subscriptionId } },
        success_url: successUrl,
        cancel_url: cancelUrl,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      },
      { idempotencyKey: subscriptionId },
    );
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
    return { sessionId: session.id, url: session.url };
  },

  async createPortalLink({ providerCustomerId, returnUrl }) {
    if (!providerCustomerId) throw new Error("No Stripe customer for this subscription yet");
    const session = await client().billingPortal.sessions.create({
      customer: providerCustomerId,
      return_url: returnUrl,
    });
    return session.url;
  },

  async parseWebhook(payload, headers): Promise<PaymentEvent | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = headers.get("stripe-signature");
    if (!secret) throw new WebhookSignatureError("STRIPE_WEBHOOK_SECRET is not set");
    if (!signature) throw new WebhookSignatureError("Missing stripe-signature header");

    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      throw new WebhookSignatureError((error as Error).message);
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const id = session.client_reference_id;
        if (!id) return null;
        if (session.mode === "subscription") {
          // Credits come with invoice.paid; this links the IDs early.
          return {
            kind: "subscription",
            subscriptionId: id,
            providerSubscriptionId: idOf(session.subscription),
            providerCustomerId: idOf(session.customer),
          };
        }
        // "unpaid" means a delayed method (e.g. bank debit) is still
        // processing; async_payment_succeeded follows.
        return session.payment_status === "paid" ? { kind: "order", orderId: id, outcome: "paid" } : null;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        const id = session.client_reference_id;
        if (!id) return null;
        if (session.mode === "subscription") {
          // A failed first payment leaves the subscription incomplete;
          // Stripe expires it and sends customer.subscription.deleted.
          return event.type === "checkout.session.expired"
            ? { kind: "subscription", subscriptionId: id, status: "expired" }
            : null;
        }
        const outcome = event.type === "checkout.session.expired" ? "expired" : "failed";
        return { kind: "order", orderId: id, outcome };
      }
      case "invoice.paid": {
        const invoice = event.data.object;
        const details = invoice.parent?.subscription_details;
        const subscriptionId = details?.metadata?.subscriptionId;
        if (!invoice.id || !subscriptionId) return null;
        return {
          kind: "subscription",
          subscriptionId,
          providerSubscriptionId: idOf(details.subscription),
          providerCustomerId: idOf(invoice.customer),
          paymentId: invoice.id,
        };
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const subscriptionId = subscription.metadata?.subscriptionId;
        if (!subscriptionId) return null;
        const periodEnd = subscription.items?.data[0]?.current_period_end;
        return {
          kind: "subscription",
          subscriptionId,
          providerSubscriptionId: subscription.id,
          providerCustomerId: idOf(subscription.customer),
          status: subscriptionStatus(subscription),
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
        };
      }
      case "charge.refunded": {
        // Fires per refund with the charge's running total; the previous
        // total gives this refund's share.
        const charge = event.data.object;
        const before = (event.data.previous_attributes as Partial<Stripe.Charge> | undefined)?.amount_refunded ?? 0;
        const target = await refundTarget(idOf(charge.payment_intent) ?? null);
        if (!target) return null;
        return { kind: "refund", refundId: event.id, target, refunded: charge.amount_refunded - before, charged: charge.amount };
      }
      case "charge.dispute.funds_withdrawn": {
        // A chargeback the bank took back: the disputed amount is gone.
        const dispute = event.data.object;
        const target = await refundTarget(idOf(dispute.payment_intent) ?? null);
        if (!target) return null;
        return { kind: "refund", refundId: event.id, target, refunded: dispute.amount, charged: dispute.amount };
      }
      default:
        return null;
    }
  },
};
