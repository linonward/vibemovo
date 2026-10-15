import { expect, test } from "@playwright/test";
import { POSTHOG_HOST } from "../playwright.config";
import { getSession, signIn } from "./support/auth";

test("links landing visits across reload and magic-link sign-in", async ({ page }) => {
  const events: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];
  const host = POSTHOG_HOST;
  await page.route(`${host}/i/v0/e/`, async (route) => {
    events.push(JSON.parse(route.request().postData()!));
    await route.fulfill({ status: 200, body: "{}", headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto("/en");
  await expect.poll(() => events.length).toBe(1);
  const anonymous = events[0].distinct_id;
  await page.reload();
  await expect.poll(() => events.length).toBe(2);
  expect(events[1].distinct_id).toBe(anonymous);
  await signIn(page);
  const session = await getSession(page);
  await expect.poll(() => events.some((event) => event.event === "$identify")).toBe(true);
  expect(events.find((event) => event.event === "$identify")).toMatchObject({
    distinct_id: `vibemovo:${session.user.id}`, properties: { $anon_distinct_id: anonymous },
  });
  await expect.poll(() => events.some((event) => event.event === "$pageview"
    && event.distinct_id === `vibemovo:${session.user.id}`)).toBe(true);
});
