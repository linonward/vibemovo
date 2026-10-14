import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// The flag is read when the module loads, as a build inlines it.
async function renderAnalytics(flag: string) {
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ANALYTICS", flag);
  const { Analytics } = await import("./analytics");
  render(<Analytics />);
}

test("renders Vercel Web Analytics when the flag is 1", async () => {
  await renderAnalytics("1");

  expect(await screen.findByTestId("vercel-analytics")).toBeTruthy();
});

test("renders nothing without the flag", async () => {
  await renderAnalytics("");

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByTestId("vercel-analytics")).toBeNull();
});
