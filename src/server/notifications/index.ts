import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { NOTIFICATIONS_PAGE_SIZE } from "./config";
import { notification } from "./schema";
import type { NotificationContent } from "./types";
import { log } from "@/server/log";

export type { NotificationContent } from "./types";

export type Notification = NotificationContent & {
  id: string;
  readAt: Date | null;
  createdAt: Date;
};

// Stores a notification for the user. The key names the event, so a retry
// stores nothing twice. Returns whether it stored a new one, so a caller can
// act once per event (such as sending an email). A notification is never
// worth failing the caller for: errors are logged instead.
export async function notify(userId: string, key: string, content: NotificationContent): Promise<boolean> {
  try {
    const stored = await getDb()
      .insert(notification)
      .values({ userId, key, type: content.type, data: content.data })
      .onConflictDoNothing({ target: notification.key })
      .returning({ id: notification.id });
    return stored.length > 0;
  } catch (error) {
    log.error("notification.not_stored", { userId, key, error });
    return false;
  }
}

// One page of the user's notifications, newest first. `total` counts them all.
export async function pageNotifications(
  userId: string,
  page = 1,
  pageSize = NOTIFICATIONS_PAGE_SIZE,
): Promise<{ notifications: Notification[]; total: number }> {
  const db = getDb();
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt), desc(notification.id))
      .limit(pageSize)
      .offset((Math.max(1, page) - 1) * pageSize),
    db.$count(notification, eq(notification.userId, userId)),
  ]);
  return { notifications: rows.map(toNotification), total };
}

export function unreadCount(userId: string): Promise<number> {
  return getDb().$count(notification, and(eq(notification.userId, userId), isNull(notification.readAt)));
}

// Marks one of the user's notifications read, or all of them without an ID.
export async function markRead(userId: string, id?: string): Promise<void> {
  await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        id ? eq(notification.id, id) : undefined,
      ),
    );
}

function toNotification(row: typeof notification.$inferSelect): Notification {
  return {
    id: row.id,
    readAt: row.readAt,
    createdAt: row.createdAt,
    // The row was stored from a NotificationContent.
    ...({ type: row.type, data: row.data } as NotificationContent),
  };
}
