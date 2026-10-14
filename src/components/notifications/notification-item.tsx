"use client";

import { CircleAlert, Clapperboard, CreditCard, Gem, ImageIcon, Megaphone } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { AppNotification } from "@/lib/api";

// Where a notification leads, by type.
export function notificationLink(n: AppNotification): string {
  switch (n.type) {
    case "image_succeeded":
    case "image_failed":
      return `/images/${n.data.imageId}`;
    case "video_succeeded":
    case "video_failed":
      return `/videos/${n.data.videoId}`;
    case "order_paid":
    case "credits_added":
    case "subscription_paid":
    case "subscription_past_due":
    case "subscription_ended":
      return "/billing";
    case "broadcast":
      return "/notifications";
  }
}

const ICONS = {
  image_succeeded: ImageIcon,
  image_failed: CircleAlert,
  video_succeeded: Clapperboard,
  video_failed: CircleAlert,
  order_paid: Gem,
  subscription_paid: CreditCard,
  subscription_past_due: CircleAlert,
  subscription_ended: CreditCard,
  credits_added: Gem,
  broadcast: Megaphone,
} satisfies Record<AppNotification["type"], React.ComponentType<{ className?: string }>>;

const WARNINGS = new Set<AppNotification["type"]>(["image_failed", "video_failed", "subscription_past_due"]);

// The notification's text, in the reader's locale; a broadcast shows the
// admin's text as written. `compact` cuts a long broadcast to two lines, for
// the bell. The caller wraps it in a link to notificationLink.
export function NotificationBody({
  notification: n,
  compact = false,
}: {
  notification: AppNotification;
  compact?: boolean;
}) {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const Icon = ICONS[n.type];
  const unread = !n.readAt;

  return (
    <>
      <Icon
        className={`mt-0.5 size-[18px] shrink-0 ${WARNINGS.has(n.type) ? "text-destructive" : "text-primary-text"}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className={`text-sm [overflow-wrap:anywhere] ${unread ? "font-semibold" : "font-medium"}`}>
          {n.type === "broadcast" ? n.data.title : t(`types.${n.type}`)}
        </span>
        <Details notification={n} compact={compact} />
        <time dateTime={n.createdAt.toISOString()} className="text-xs text-muted-foreground">
          {format.dateTime(n.createdAt, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </span>
      {unread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-text">
          <span className="sr-only">{t("unread")}</span>
        </span>
      )}
    </>
  );
}

function Details({ notification: n, compact }: { notification: AppNotification; compact: boolean }) {
  const t = useTranslations("Notifications");
  const tDashboard = useTranslations("Dashboard");
  const line = "text-sm text-muted-foreground";
  // Known plans are translated; anything else shows as stored.
  const plan = (id: string) => {
    const key = `plans.${id}` as Parameters<typeof tDashboard>[0];
    return tDashboard.has(key) ? tDashboard(key) : id;
  };

  switch (n.type) {
    case "image_succeeded":
    case "image_failed":
    case "video_succeeded":
    case "video_failed":
      return (
        <>
          <span className={`line-clamp-1 [overflow-wrap:anywhere] ${line}`}>{n.data.prompt}</span>
          {"credits" in n.data && <span className={line}>{t("refunded", { count: n.data.credits })}</span>}
        </>
      );
    case "order_paid":
    case "credits_added":
      return <span className={line}>{t("added", { count: n.data.credits })}</span>;
    case "subscription_paid":
      return <span className={line}>{t("planCredits", { plan: plan(n.data.planId), count: n.data.credits })}</span>;
    case "subscription_past_due":
      return <span className={line}>{t("pastDue", { plan: plan(n.data.planId) })}</span>;
    case "subscription_ended":
      return <span className={line}>{t("ended", { plan: plan(n.data.planId) })}</span>;
    case "broadcast":
      return (
        <span className={`[overflow-wrap:anywhere] whitespace-pre-line ${compact ? "line-clamp-2" : ""} ${line}`}>
          {n.data.body}
        </span>
      );
  }
}
