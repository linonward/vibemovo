"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
// Analytics needs the locale-prefixed URL, not the locale-stripped navigation helper.
// eslint-disable-next-line no-restricted-imports
import { usePathname } from "next/navigation";

// Only route names leave the browser. Unknown segments can contain IDs or
// user input, including on 404 pages. Never send search, hash or referrer.
const ROUTES = new Set([
  "", "pricing", "ai-rap-video-generator", "ai-zombie-couple-video", "hug-your-younger-self-ai", "ai-vampire-transformation-video", "privacy", "terms", "refund", "sign-in",
  "dashboard", "images", "images/library", "videos", "videos/library", "videos/rap", "videos/zombie", "videos/hug", "videos/vampire", "videos/effects",
  "chat", "notifications", "feedback", "billing", "api-keys", "profile", "admin",
  "admin/users", "admin/orders", "admin/notifications", "admin/metrics", "admin/feedback", "blog",
]);
function routeName(pathname: string) {
  const [, language, ...parts] = pathname.split("/");
  const locale = language === "en" || language === "zh" ? language : "unknown";
  const path = parts.join("/").replace(/\/$/, "");
  if (ROUTES.has(path)) return `/${locale}${path ? `/${path}` : ""}`;
  for (const prefix of ["images", "videos", "chat", "admin/users", "blog/tags", "blog"]) {
    if (path.startsWith(`${prefix}/`)) return `/${locale}/${prefix}/:id`;
  }
  return `/${locale}/:other`;
}

const STORAGE_KEY = "vibemovo:analytics";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
type Identity = { anonymous: string; userId: string | null; expires: number };

function readIdentity(): Identity | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (value && /^vibemovo:anonymous:[0-9a-f-]{36}$/.test(value.anonymous)
      && (value.userId === null || typeof value.userId === "string")
      && value.expires > Date.now() && value.expires <= Date.now() + MAX_AGE) return value;
  } catch { /* Storage may be blocked. Keep this visit in memory instead. */ }
  return null;
}

export function PostHogPageviews() {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !process.env.NEXT_PUBLIC_POSTHOG_HOST) return null;
  return <TrackedPageviews />;
}

function TrackedPageviews() {
  const pathname = usePathname();
  const { data: session, isPending, error } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const identity = useRef<Identity | null>(null);
  const linked = useRef<string | null>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!token || !host || !pathname || isPending || error) return;
    // Re-read shared storage so another tab's logout/account switch is seen.
    let current = readIdentity() ?? identity.current;
    if (!current || current.expires <= Date.now() || (current.userId !== null && current.userId !== userId)) {
      current = { anonymous: `vibemovo:anonymous:${crypto.randomUUID()}`, userId: null, expires: Date.now() + MAX_AGE };
    }
    const distinctId = userId ? `vibemovo:${userId}` : current.anonymous;
    current.userId = userId;
    identity.current = current;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* In-memory fallback. */ }
    const send = (event: string, properties: Record<string, unknown>) => fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        api_key: token, event, distinct_id: distinctId, timestamp: new Date().toISOString(),
        properties: { app: "vibemovo", $process_person_profile: Boolean(userId), $geoip_disable: true, ...properties },
      }),
    });
    const link = `${current.anonymous}:${distinctId}`;
    if (userId && linked.current !== link) {
      linked.current = link;
      void send("$identify", { $anon_distinct_id: current.anonymous }).then((response) => {
        if (!response.ok && linked.current === link) linked.current = null;
      }).catch(() => { if (linked.current === link) linked.current = null; });
    }
    const page = `${distinctId}:${pathname}`;
    if (previous.current === page) return;
    previous.current = page;
    const path = routeName(pathname);
    void send("$pageview", { $pathname: path, $current_url: `${window.location.origin}${path}`,
      $host: window.location.host }).catch(() => {});
  }, [pathname, userId, isPending, error]);
  return null;
}
