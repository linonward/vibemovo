"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentVisible } from "@/hooks/use-document-visible";
import type { ApiBody, AppNotification, NotificationsResponse, UnreadResponse } from "@/lib/api";

// The unread count and the newest notifications, for the bell. The
// dashboard layout reads the count once; this polls for new ones while a
// dashboard page is open and its tab is visible, and catches up when the
// tab comes back.

export const POLL_MS = 60_000;

type Notifications = {
  unread: number;
  // Null until the first fetch.
  recent: AppNotification[] | null;
  refresh: () => Promise<void>;
  // Marks one notification read, or all of them without an ID.
  markRead: (id?: string) => Promise<void>;
};

const NotificationsContext = createContext<Notifications | null>(null);

export function NotificationsProvider({
  unread: initial,
  children,
}: {
  unread: number;
  children: React.ReactNode;
}) {
  const [unread, setUnread] = useState(initial);
  const [recent, setRecent] = useState<AppNotification[] | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications").catch(() => null);
    if (!response?.ok) return;
    const body: ApiBody<NotificationsResponse> = await response.json();
    if (typeof body.unread === "number") setUnread(body.unread);
    if (body.notifications) setRecent(body.notifications.map(parse));
  }, []);

  const markRead = useCallback(async (id?: string) => {
    const readAt = new Date();
    setRecent((list) => list?.map((n) => ((!id || n.id === id) && !n.readAt ? { ...n, readAt } : n)) ?? null);
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
      // Clicking a notification leaves the page; let the request finish.
      keepalive: true,
    }).catch(() => null);
    if (!response?.ok) return;
    const body: ApiBody<UnreadResponse> = await response.json();
    if (typeof body.unread === "number") setUnread(body.unread);
  }, []);

  const visible = useDocumentVisible();
  const missed = useRef(false);
  useEffect(() => {
    if (!visible) {
      missed.current = true;
      return;
    }
    if (missed.current) {
      missed.current = false;
      void refresh();
    }
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [visible, refresh]);

  const value = useMemo(() => ({ unread, recent, refresh, markRead }), [unread, recent, refresh, markRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// Null outside the dashboard.
export function useNotifications() {
  return useContext(NotificationsContext);
}

function parse(n: NonNullable<ApiBody<NotificationsResponse>["notifications"]>[number]): AppNotification {
  return { ...n, createdAt: new Date(n.createdAt), readAt: n.readAt ? new Date(n.readAt) : null } as AppNotification;
}
