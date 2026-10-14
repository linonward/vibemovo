"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: "light" | "dark";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

// Loads Cloudflare's script once per page, however many widgets mount.
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.append(script);
  });
  return loading;
}

// Cloudflare Turnstile challenge. Calls onToken with a token once the
// visitor passes, and with null when it expires or fails. A token works
// once: remount the widget (change its key) for a new one.
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // The latest callback, without re-rendering the widget when it changes.
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  });

  useEffect(() => {
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    let active = true;

    loadTurnstile()
      .then((turnstile) => {
        if (!active || !container.current) return;
        api = turnstile;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          // Match the site's theme, not the system's.
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          size: "flexible",
          callback: (token) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));

    return () => {
      active = false;
      if (api && widgetId) api.remove(widgetId);
    };
  }, [siteKey]);

  return <div ref={container} className="min-h-[65px]" />;
}
