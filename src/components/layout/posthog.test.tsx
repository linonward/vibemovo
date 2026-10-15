import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PostHogPageviews } from "./posthog";
let session: { user: { id: string } } | null = null;
let pending = false;
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: session, isPending: pending, error: null }) } }));
let pathname = "/en/images/private-job-id";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
afterEach(() => { cleanup(); localStorage.clear(); session = null; pending = false; pathname = "/en/images/private-job-id"; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
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

function enabled() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
it("links a returning anonymous browser to the account used by server events", async () => {
  const fetcher = enabled();
  const first = render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const anonymous = JSON.parse(fetcher.mock.calls[0][1].body).distinct_id;
  first.unmount();
  session = { user: { id: "account-1" } };
  render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  const events = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
  expect(events[1]).toMatchObject({ event: "$identify", distinct_id: "vibemovo:account-1",
    properties: { $anon_distinct_id: anonymous, $process_person_profile: true } });
  expect(events[2]).toMatchObject({ event: "$pageview", distinct_id: "vibemovo:account-1" });
});
it("rotates identity on logout and never merges two accounts", async () => {
  const fetcher = enabled();
  session = { user: { id: "account-1" } };
  const view = render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const firstAnonymous = JSON.parse(fetcher.mock.calls[0][1].body).properties.$anon_distinct_id;
  session = null; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  const loggedOut = JSON.parse(fetcher.mock.calls[2][1].body).distinct_id;
  expect(loggedOut).not.toBe(firstAnonymous);
  session = { user: { id: "account-2" } }; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
  expect(JSON.parse(fetcher.mock.calls[3][1].body)).toMatchObject({
    event: "$identify", distinct_id: "vibemovo:account-2", properties: { $anon_distinct_id: loggedOut },
  });
  session = { user: { id: "account-3" } }; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(7));
  const switched = JSON.parse(fetcher.mock.calls[5][1].body);
  expect(switched.distinct_id).toBe("vibemovo:account-3");
  expect(switched.properties.$anon_distinct_id).not.toBe(loggedOut);
});
it("waits for session resolution", () => {
  const fetcher = enabled(); pending = true;
  render(<PostHogPageviews />);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rotates expired identifiers and tolerates blocked storage", async () => {
  const fetcher = enabled();
  const expired = "vibemovo:anonymous:00000000-0000-4000-8000-000000000000";
  localStorage.setItem("vibemovo:analytics", JSON.stringify({ anonymous: expired, userId: null, expires: Date.now() - 1 }));
  const first = render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(fetcher.mock.calls[0][1].body).distinct_id).not.toBe(expired);
  first.unmount();
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  try {
    const view = render(<PostHogPageviews />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    const id = JSON.parse(fetcher.mock.calls[1][1].body).distinct_id;
    pathname = "/zh/pricing"; view.rerender(<PostHogPageviews />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(JSON.parse(fetcher.mock.calls[2][1].body).distinct_id).toBe(id);
  } finally { read.mockRestore(); write.mockRestore(); }
});
it("retries failed identification on navigation without repeating successful identification", async () => {
  const fetcher = enabled();
  session = { user: { id: "account-1" } };
  fetcher.mockResolvedValueOnce(new Response("", { status: 503 }));
  const view = render(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  pathname = "/en/pricing"; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
  pathname = "/en/billing"; view.rerender(<PostHogPageviews />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
  expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body).event))
    .toEqual(["$identify", "$pageview", "$identify", "$pageview", "$pageview"]);
});
