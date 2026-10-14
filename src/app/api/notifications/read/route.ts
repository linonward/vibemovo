import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type UnreadResponse } from "@/lib/api";
import { markRead, unreadCount } from "@/server/notifications";

// Body: { id } marks one notification read; {} marks them all. Returns { unread }.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const id = body?.id;
  if (id !== undefined && (typeof id !== "string" || !id)) return apiError("INVALID_REQUEST", 400);

  const userId = session.user.id;
  await markRead(userId, id);
  return Response.json({ unread: await unreadCount(userId) } satisfies UnreadResponse);
}, { limit: LIMITS.notificationsRead });
