"use client";

import { useEffect, useRef } from "react";
// Analytics needs the locale-prefixed URL, not the locale-stripped navigation helper.
// eslint-disable-next-line no-restricted-imports
import { usePathname } from "next/navigation";

// Only route names leave the browser. Unknown segments can contain IDs or
// user input, including on 404 pages. Never send search, hash or referrer.
const ROUTES = new Set([
  "", "pricing", "ai-rap-video-generator", "privacy", "terms", "refund", "sign-in",
  "dashboard", "images", "images/library", "videos", "videos/library", "videos/rap",
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

export function PostHogPageviews() {
  const pathname = usePathname();
  const visitor = useRef<string | null>(null);
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
    if (!token || !host || !pathname || previous.current === pathname) return;
    previous.current = pathname;
    visitor.current ??= `vibemovo:anonymous:${crypto.randomUUID()}`;
    const path = routeName(pathname);
    // text/plain avoids a CORS preflight; PostHog accepts JSON in this body.
    void fetch(`${host.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        api_key: token, event: "$pageview", distinct_id: visitor.current,
        timestamp: new Date().toISOString(),
        properties: {
          app: "vibemovo", $pathname: path, $current_url: `${window.location.origin}${path}`,
          $host: window.location.host, $process_person_profile: false, $geoip_disable: true,
        },
      }),
    }).catch(() => {});
  }, [pathname]);
  return null;
}
