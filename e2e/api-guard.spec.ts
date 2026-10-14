import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { signIn } from "./support/auth";

// A signed-in user's cookie rides along on requests other sites trigger, so
// routes that change data accept only the app's own Origin.
test("refuses a request that changes data from another site or no site", async ({ page }) => {
  await signIn(page);

  const foreign: Record<string, string>[] = [{ origin: "https://evil.example" }, {}];
  for (const headers of foreign) {
    const response = await page.request.post("/api/notifications/read", { data: {}, headers });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN_ORIGIN" });
  }

  const own = await page.request.post("/api/notifications/read", { data: {}, headers: { origin: BASE_URL } });
  expect(own.status()).toBe(200);
});

test("the app's own pages pass the Origin check", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/notifications");

  // A same-origin fetch from the page, as the bell's "Mark all as read" sends.
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.status;
  });
  expect(status).toBe(200);
});
