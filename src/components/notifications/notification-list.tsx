"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Pagination } from "@/components/dashboard/pagination";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppNotification } from "@/lib/api";
import { NotificationBody, notificationLink } from "./notification-item";
import { useNotifications } from "./notifications";

// One page of /notifications. Opening a notification marks it read.
export function NotificationList({
  notifications: initial,
  page,
  pageCount,
}: {
  notifications: AppNotification[];
  page: number;
  pageCount: number;
}) {
  const t = useTranslations("Notifications");
  const context = useNotifications();
  const [notifications, setNotifications] = useState(initial);

  function read(id?: string) {
    const readAt = new Date();
    setNotifications((list) => list.map((n) => ((!id || n.id === id) && !n.readAt ? { ...n, readAt } : n)));
    void context?.markRead(id);
  }

  if (notifications.length === 0) return <p className="text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-4">
      {(context?.unread ?? 0) > 0 && (
        <Button variant="outline" className="self-end" onClick={() => read()}>
          {t("markAllRead")}
        </Button>
      )}
      <ul aria-label={t("title")} className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
        {notifications.map((n) => (
          <li key={n.id}>
            <Link
              href={notificationLink(n)}
              onClick={() => !n.readAt && read(n.id)}
              className="flex items-start gap-3 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [@media(hover:hover)]:hover:bg-accent"
            >
              <NotificationBody notification={n} />
            </Link>
          </li>
        ))}
      </ul>
      <Pagination pathname="/notifications" page={page} pageCount={pageCount} />
    </div>
  );
}
