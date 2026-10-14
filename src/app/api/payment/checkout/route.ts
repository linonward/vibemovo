import { hasLocale } from "next-intl";
import { withSession } from "@/app/api/_lib/with-session";
import { routing } from "@/i18n/routing";
import { apiError, type RedirectResponse } from "@/lib/api";
import { log } from "@/server/log";
import { createCheckout, PaymentsDisabledError, UnknownPackError } from "@/server/payment/orders";

// Starts a checkout for a credit pack. Body: { packId, locale }.
// Returns { url } to send the browser to.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const packId = typeof body.packId === "string" ? body.packId : "";
  const locale = hasLocale(routing.locales, body.locale) ? body.locale : routing.defaultLocale;
  const billing = new URL(`/${locale}/billing`, process.env.BETTER_AUTH_URL ?? request.url);

  try {
    const url = await createCheckout({
      userId: session.user.id,
      email: session.user.email,
      packId,
      locale,
      successUrl: `${billing}?checkout=success`,
      cancelUrl: `${billing}?checkout=cancel`,
    });
    return Response.json({ url } satisfies RedirectResponse);
  } catch (error) {
    if (error instanceof UnknownPackError) {
      return apiError("UNKNOWN_PACK", 400);
    }
    if (error instanceof PaymentsDisabledError) {
      return apiError("PAYMENTS_DISABLED", 503);
    }
    log.error("payment.checkout_failed", { userId: session.user.id, packId, error });
    return apiError("CHECKOUT_FAILED", 502);
  }
});
