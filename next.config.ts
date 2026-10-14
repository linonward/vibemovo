import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "./src/i18n/routing";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withMDX = createMDX();

// Sent with every response. No other site may frame the app, so it can't
// trick a user into clicking (clickjacking); X-Frame-Options covers older
// browsers. nosniff stops browsers from guessing content types.
// HSTS keeps browsers on HTTPS for two years once they've seen it; they
// ignore it over plain http, so local development is unaffected. It leaves
// out includeSubDomains and preload, which would bind every subdomain and
// are hard to undo. Other sites get only the origin as the referrer, never
// a path with IDs in it.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The Dockerfile sets BUILD_STANDALONE: .next/standalone then holds a
  // server.js and only the node_modules files it needs.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  // The credit history moved into /billing. Keeps old links and bookmarks working.
  redirects: async () => [
    {
      source: `/:locale(${routing.locales.join("|")})/credits`,
      destination: "/:locale/billing",
      permanent: true,
    },
  ],
  // Off, so a page's first request for a path generateStaticParams didn't
  // list waits for the render. When on, Next.js streams the route's App
  // Shell with status 200 first, and a notFound() for an unknown post or
  // tag becomes a soft 404 (200 with noindex).
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const config = withMDX(withNextIntl(nextConfig));

// With a Sentry auth token at build time, upload source maps so Sentry
// shows readable stack traces. Error reporting itself needs only the DSN.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
    })
  : config;
