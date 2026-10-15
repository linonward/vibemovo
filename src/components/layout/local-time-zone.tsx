"use client";

import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from "next-intl";
import { useSyncExternalStore } from "react";

// The browser's time zone never changes while the page is open.
const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const noTimeZone = () => null;

// Client components format dates in the reader's time zone. The server
// doesn't know it and renders in UTC (src/i18n/request.ts); hydration
// matches that, then React renders again with the browser's zone. The
// provider stays in place either way, so nothing below it remounts.
export function LocalTimeZone({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const serverTimeZone = useTimeZone();
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, noTimeZone) ?? serverTimeZone;

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
