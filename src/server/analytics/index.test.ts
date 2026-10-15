import { afterEach, expect, it, vi } from "vitest";
import { capture } from "./index";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("does nothing without configuration", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await capture("signup_completed", "account-1");
  expect(fetcher).not.toHaveBeenCalled();
});
it("sends only explicit properties without profiles or geo enrichment", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetcher);
  await capture("generation_succeeded", "account-1", { kind: "image", credits: 5 });
  expect(fetcher.mock.calls[0][0]).toBe("https://us.i.posthog.com/capture/");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    api_key: "phc_test", event: "generation_succeeded", distinct_id: "vibemovo:account-1",
    properties: { app: "vibemovo", kind: "image", credits: 5, $process_person_profile: false, $geoip_disable: true },
  });
});
it("never fails the business operation on network or HTTP errors", async () => {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(capture("signup_completed", "account-1")).resolves.toBeUndefined();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  await expect(capture("signup_completed", "account-1")).resolves.toBeUndefined();
});
