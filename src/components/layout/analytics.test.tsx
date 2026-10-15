import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => <div data-testid="vercel-speed-insights" />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// The flags are read when the module loads, as a build inlines them.
async function renderAnalytics({ analytics = "", speedInsights = "" }) {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS", analytics);
  vi.stubEnv("NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS", speedInsights);
  const { Analytics } = await import("./analytics");
  render(<Analytics />);
}

test("renders Vercel Web Analytics when its flag is 1", async () => {
  await renderAnalytics({ analytics: "1" });

  expect(await screen.findByTestId("vercel-analytics")).toBeTruthy();
  expect(screen.queryByTestId("vercel-speed-insights")).toBeNull();
});

test("renders Vercel Speed Insights when its flag is 1", async () => {
  await renderAnalytics({ speedInsights: "1" });

  expect(await screen.findByTestId("vercel-speed-insights")).toBeTruthy();
  expect(screen.queryByTestId("vercel-analytics")).toBeNull();
});

test("renders nothing without the flags", async () => {
  await renderAnalytics({});

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByTestId("vercel-analytics")).toBeNull();
  expect(screen.queryByTestId("vercel-speed-insights")).toBeNull();
});
