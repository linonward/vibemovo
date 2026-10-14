import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type BalanceResponse } from "@/lib/api";
import { isAdmin } from "@/server/admin/access";
import { addCredits, InvalidAddCreditsError, UnknownUserError } from "@/server/admin/credits";
import { log } from "@/server/log";

// Adds credits to a user by hand. Admins only (ADMIN_EMAILS).
// Body: { userId, amount, requestId }. Returns { balance }.
export const POST = withSession(async (request, { session }) => {
  // Same answer as the admin page gives non-admins: the route isn't there.
  if (!isAdmin(session.user.email)) return apiError("NOT_FOUND", 404);

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const amount = typeof body.amount === "number" ? body.amount : Number.NaN;

  try {
    const balance = await addCredits({ userId, amount, requestId });
    log.info("admin.credits_added", { admin: session.user.email, userId, amount });
    return Response.json({ balance } satisfies BalanceResponse);
  } catch (error) {
    if (error instanceof InvalidAddCreditsError) {
      return apiError("INVALID_REQUEST", 400);
    }
    if (error instanceof UnknownUserError) {
      return apiError("UNKNOWN_USER", 404);
    }
    throw error;
  }
});
