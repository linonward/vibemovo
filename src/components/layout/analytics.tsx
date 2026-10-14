"use client";

import dynamic from "next/dynamic";

// Vercel Web Analytics (page views, without cookies) and Speed Insights
// (Core Web Vitals from real visits). Both work only on Vercel, with the
// feature enabled for the project. The flags are read at build time;
// without one the browser never downloads its package.
const VercelAnalytics =
  process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1"
    ? dynamic(() => import("@vercel/analytics/next").then((mod) => mod.Analytics))
    : null;

const VercelSpeedInsights =
  process.env.NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS === "1"
    ? dynamic(() => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights))
    : null;

export function Analytics() {
  return (
    <>
      {VercelAnalytics && <VercelAnalytics />}
      {VercelSpeedInsights && <VercelSpeedInsights />}
    </>
  );
}
