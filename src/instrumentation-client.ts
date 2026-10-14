// Runs in the browser before the app starts. With NEXT_PUBLIC_SENTRY_DSN
// set at build time, Sentry reports uncaught errors and rejections; without
// it the SDK is never downloaded. Errors only: no tracing or replay.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init({ dsn }));
}
