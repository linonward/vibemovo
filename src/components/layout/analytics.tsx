"use client";

import dynamic from "next/dynamic";

// Vercel Web Analytics: page views, without cookies. Works only on Vercel,
// with Analytics enabled for the project. The flag is read at build time;
// without it the browser never downloads the package.
const VercelAnalytics =
  process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1"
    ? dynamic(() => import("@vercel/analytics/next").then((mod) => mod.Analytics))
    : null;

export function Analytics() {
  return VercelAnalytics ? <VercelAnalytics /> : null;
}
