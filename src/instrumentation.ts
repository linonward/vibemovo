import type { Instrumentation } from "next";

// Runs once when the server starts. On a misconfigured deployment Next.js
// logs the problems and answers every request with 500, so health checks
// fail instead of the app half-working.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertValidEnv } = await import("@/server/env");
  assertValidEnv();
  const { initMonitoring } = await import("@/server/monitoring");
  await initMonitoring();
}

// Errors thrown while rendering or handling a request go to Sentry when
// NEXT_PUBLIC_SENTRY_DSN is set.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("@/server/monitoring");
  await reportRequestError({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN }, ...args);
};
