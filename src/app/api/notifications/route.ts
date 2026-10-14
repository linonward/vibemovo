import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import type { NotificationsResponse } from "@/lib/api";
import { pageNotifications, unreadCount } from "@/server/notifications";
import { RECENT_NOTIFICATIONS } from "@/server/notifications/config";

// The bell polls this: { notifications } (the newest few) and { unread }.
export const GET = withSession(async (_request, { session }) => {
  const userId = session.user.id;
  const [{ notifications }, unread] = await Promise.all([
    pageNotifications(userId, 1, RECENT_NOTIFICATIONS),
    unreadCount(userId),
  ]);
  return Response.json({ notifications, unread } satisfies NotificationsResponse);
}, { limit: LIMITS.notifications });
