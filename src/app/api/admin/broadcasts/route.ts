import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type BroadcastResponse } from "@/lib/api";
import { isAdmin } from "@/server/admin/access";
import { log } from "@/server/log";
import { InvalidBroadcastError, sendBroadcast, UnknownRecipientError } from "@/server/notifications/broadcasts";

// Sends a notification to every user, or to one by email. Admins only
// (ADMIN_EMAILS). Body: { title, body, email?, requestId }.
// Returns { broadcast: { id, recipients } }.
export const POST = withSession(async (request, { session }) => {
  // Same answer as the admin page gives non-admins: the route isn't there.
  if (!isAdmin(session.user.email)) return apiError("NOT_FOUND", 404);

  const body = await request.json().catch(() => ({}));
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  try {
    const sent = await sendBroadcast({
      title: text(body.title),
      body: text(body.body),
      email: text(body.email) || undefined,
      requestId: text(body.requestId),
      sentBy: session.user.email,
    });
    log.info("admin.broadcast_sent", { admin: session.user.email, id: sent.id, recipients: sent.recipients });
    return Response.json({ broadcast: { id: sent.id, recipients: sent.recipients } } satisfies BroadcastResponse);
  } catch (error) {
    if (error instanceof InvalidBroadcastError) return apiError("INVALID_REQUEST", 400);
    if (error instanceof UnknownRecipientError) return apiError("UNKNOWN_USER", 404);
    throw error;
  }
});
