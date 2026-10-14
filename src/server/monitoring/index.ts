import type { Instrumentation } from "next";
import { onErrorLogged } from "@/server/log";

type Env = Record<string, string | undefined>;

// Sentry error tracking, off unless NEXT_PUBLIC_SENTRY_DSN is set. Without
// it, @sentry/nextjs is never loaded. Errors only: no tracing or replay.
// The browser starts its own client in src/instrumentation-client.ts.

// Starts Sentry on the server and reports every logged error, so errors the
// code catches and logs reach it too. Returns a function that stops the
// reporting, or undefined when it's off.
export async function initMonitoring(env: Env = process.env) {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return undefined;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn });
  return onErrorLogged((event, fields) => {
    const error = Object.values(fields).find((value) => value instanceof Error);
    Sentry.captureException(error ?? new Error(event), { tags: { event }, extra: fields });
  });
}

// Errors thrown while rendering or handling a request (Next.js's
// onRequestError hook): Server Components, route handlers and the proxy.
export async function reportRequestError(
  { dsn }: { dsn: string | undefined },
  ...args: Parameters<Instrumentation.onRequestError>
) {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
