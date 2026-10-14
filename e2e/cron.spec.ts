import { expect, test } from "@playwright/test";
import { CRON_SECRET } from "../playwright.config";

// POST for any scheduler; GET because Vercel Cron sends GET.
for (const method of ["post", "get"] as const) {
  test(`the sweep answers only the scheduler (${method.toUpperCase()})`, async ({ request }) => {
    for (const authorization of [undefined, "Bearer wrong"]) {
      const response = await request[method]("/api/cron/sweep", {
        headers: authorization ? { authorization } : {},
      });
      expect(response.status()).toBe(404);
    }

    const response = await request[method]("/api/cron/sweep", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      images: { failed: expect.any(Number), checked: expect.any(Number) },
      videos: { failed: expect.any(Number), checked: expect.any(Number) },
      subscriptionMonths: expect.any(Number),
      uploads: expect.any(Number),
    });
  });
}
