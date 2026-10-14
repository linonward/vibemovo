import { hasLocale } from "next-intl";
import { withSession } from "@/app/api/_lib/with-session";
import { routing } from "@/i18n/routing";
import { apiError, type RedirectResponse } from "@/lib/api";
import { log } from "@/server/log";
import { createPortalLink, NoSubscriptionError } from "@/server/payment/subscriptions";

// Opens the provider's customer portal for the user's subscription.
// Body: { locale }. Returns { url } to send the browser to.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const locale = hasLocale(routing.locales, body.locale) ? body.locale : routing.defaultLocale;
  const billing = new URL(`/${locale}/billing`, process.env.BETTER_AUTH_URL ?? request.url);

  try {
    const url = await createPortalLink(session.user.id, billing.toString());
    return Response.json({ url } satisfies RedirectResponse);
  } catch (error) {
    if (error instanceof NoSubscriptionError) {
      return apiError("NO_SUBSCRIPTION", 404);
    }
    log.error("payment.portal_failed", { userId: session.user.id, error });
    return apiError("PORTAL_FAILED", 502);
  }
});
