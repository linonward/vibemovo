import { expect, test } from "@playwright/test";
import { INDEXNOW_KEY } from "../playwright.config";

// Search engines fetch the key to check that the site sent the URLs.
test("the IndexNow key file serves the key", async ({ request }) => {
  const response = await request.get("/indexnow.txt");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/plain; charset=utf-8");
  expect(await response.text()).toBe(INDEXNOW_KEY);
});

// A successful submission would reach the real IndexNow API, so E2E checks
// only that strangers can't trigger one. Unit tests cover the rest.
test("only the operator can submit URLs to IndexNow", async ({ request }) => {
  for (const authorization of [undefined, "Bearer wrong"]) {
    const response = await request.post("/api/indexnow", { headers: authorization ? { authorization } : {} });
    expect(response.status()).toBe(404);
  }
});
