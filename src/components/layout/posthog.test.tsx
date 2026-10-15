import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PostHogPageviews } from "./posthog";
let pathname = "/en/images/private-job-id";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("records sanitized routes, excludes queries, and records later navigation", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetcher);
  const view = render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  let body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.properties.$pathname).toBe("/en/images/:id");
  expect(JSON.stringify(body)).not.toContain("private-job-id");
  const id = body.distinct_id;
  pathname = "/en/pricing"; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  body = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(body.distinct_id).toBe(id);
  expect(body.properties.$pathname).toBe("/en/pricing");
  expect(fetcher.mock.calls[0][1].credentials).toBe("omit");
});
it("makes no requests while disabled", () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<PostHogPageviews />);
  expect(fetcher).not.toHaveBeenCalled();
});
