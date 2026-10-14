"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { NotificationBody, notificationLink } from "./notification-item";
import { useNotifications } from "./notifications";

// The bell with the unread count. Opening it fetches the newest
// notifications; choosing one marks it read and opens what it is about.
export function NotificationBell({ side = "bottom" }: { side?: "bottom" | "right" }) {
  const t = useTranslations("Notifications");
  const notifications = useNotifications();
  if (!notifications) return null;
  const { unread, recent, refresh, markRead } = notifications;

  return (
    <DropdownMenu onOpenChange={(open) => open && void refresh()}>
      <DropdownMenuTrigger
        aria-label={unread ? t("bellUnread", { count: unread }) : t("title")}
        title={t("title")}
        className="relative flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-ring data-popup-open:bg-sidebar-accent [@media(hover:hover)]:hover:bg-sidebar-accent [@media(hover:hover)]:hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground tabular-nums"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        align="start"
        sideOffset={8}
        className="flex w-80 max-w-[calc(100vw-1rem)] flex-col gap-1 rounded-2xl p-2"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <p className="font-semibold">{t("title")}</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markRead()}
              className="rounded-md px-1.5 py-0.5 text-sm text-primary-text focus-visible:outline-2 focus-visible:outline-ring [@media(hover:hover)]:hover:underline"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
        {recent === null ? (
          <p role="status" className="px-2 py-4 text-sm text-muted-foreground">
            {t("loading")}
          </p>
        ) : recent.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              render={<Link href={notificationLink(n)} />}
              onClick={() => !n.readAt && void markRead(n.id)}
              className="items-start gap-3 rounded-xl px-2 py-2"
            >
              <NotificationBody notification={n} compact />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuItem render={<Link href="/notifications" />} className="justify-center rounded-xl py-2 text-sm font-medium">
          {t("viewAll")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
