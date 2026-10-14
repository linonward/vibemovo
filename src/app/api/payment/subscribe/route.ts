import { hasLocale } from "next-intl";
import { withSession } from "@/app/api/_lib/with-session";
import { routing } from "@/i18n/routing";
import { apiError, type RedirectResponse } from "@/lib/api";
import { log } from "@/server/log";
import { PaymentsDisabledError } from "@/server/payment/orders";
import {
  AlreadySubscribedError,
  CheckoutPendingError,
  createSubscriptionCheckout,
  UnknownPlanError,
} from "@/server/payment/subscriptions";

// Starts a subscription checkout. Body: { planId, locale }.
// Returns { url } to send the browser to.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId : "";
  const locale = hasLocale(routing.locales, body.locale) ? body.locale : routing.defaultLocale;
  const billing = new URL(`/${locale}/billing`, process.env.BETTER_AUTH_URL ?? request.url);

  try {
    const url = await createSubscriptionCheckout({
      userId: session.user.id,
      email: session.user.email,
      planId,
      locale,
      successUrl: `${billing}?checkout=success`,
      cancelUrl: `${billing}?checkout=cancel`,
    });
    return Response.json({ url } satisfies RedirectResponse);
  } catch (error) {
    if (error instanceof UnknownPlanError) {
      return apiError("UNKNOWN_PLAN", 400);
    }
    if (error instanceof AlreadySubscribedError) {
      return apiError("ALREADY_SUBSCRIBED", 409);
    }
    if (error instanceof CheckoutPendingError) {
      return apiError("CHECKOUT_PENDING", 409);
    }
    if (error instanceof PaymentsDisabledError) {
      return apiError("PAYMENTS_DISABLED", 503);
    }
    log.error("payment.subscribe_failed", { userId: session.user.id, error });
    return apiError("CHECKOUT_FAILED", 502);
  }
});
