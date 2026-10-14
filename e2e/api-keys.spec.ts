import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { signIn } from "./support/auth";

// A script holds only the key: no cookie, no Origin.
async function createKey(page: import("@playwright/test").Page, name = "script") {
  const response = await page.request.post("/api/auth/api-key/create", {
    data: { name, expiresIn: 90 * 24 * 3600 },
    headers: { origin: BASE_URL },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as { id: string; key: string };
}

test("a script calls the image routes with a key, and nothing else", async ({ page, playwright }) => {
  await signIn(page);
  const { id, key } = await createKey(page);
  const script = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-api-key": key } });

  // E2E runs without Bailian: the request is authenticated, then refused for that.
  const submit = await script.post("/api/images", { data: { prompt: "A fox", aspect: "1:1" } });
  expect(submit.status()).toBe(503);
  expect(await submit.json()).toEqual({ error: "IMAGES_DISABLED" });
  const poll = await script.get("/api/images/00000000-0000-0000-0000-000000000000");
  expect(poll.status()).toBe(404);

  const pay = await script.post("/api/payment/checkout", { data: { packId: "small" } });
  expect(pay.status()).toBe(403);
  expect(await pay.json()).toEqual({ error: "API_KEY_NOT_ALLOWED" });

  // Revoked from the signed-in browser, the key stops working at once.
  const revoke = await page.request.post("/api/auth/api-key/delete", { data: { keyId: id }, headers: { origin: BASE_URL } });
  expect(revoke.status()).toBe(200);
  const after = await script.get("/api/images/00000000-0000-0000-0000-000000000000");
  expect(after.status()).toBe(401);
  expect(await after.json()).toEqual({ error: "INVALID_API_KEY" });
  await script.dispose();
});

test("a made-up key gets 401", async ({ playwright }) => {
  const script = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-api-key": "sk_nope" } });

  const response = await script.get("/api/videos/00000000-0000-0000-0000-000000000000");
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "INVALID_API_KEY" });
  await script.dispose();
});

test("signed-out visitors are sent to sign in", async ({ request }) => {
  const response = await request.get("/en/api-keys", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fapi-keys");
});

test("a user creates a key on the page, sees it once, uses it, and revokes it", async ({ page, playwright }) => {
  await signIn(page);
  await page.goto("/en/dashboard");
  await page.getByRole("navigation", { name: "Dashboard navigation" }).getByRole("link", { name: "API keys" }).click();
  await expect(page).toHaveURL("/en/api-keys");
  await expect(page.getByRole("heading", { level: 1, name: "API keys" })).toBeVisible();
  await expect(page.getByText("No keys yet.")).toBeVisible();

  await page.getByLabel("Name").fill("Nightly batch");
  await page.getByRole("button", { name: "Create key" }).click();

  const shown = page.getByRole("region", { name: "Copy your key now" });
  await expect(shown).toBeVisible();
  // The new key and the refreshed list appear together: no stale count.
  expect(await page.getByText("1 of 10 keys").isVisible()).toBe(true);
  const key = (await shown.locator("code").textContent()) ?? "";
  expect(key).toMatch(/^sk_/);
  const table = page.getByRole("table", { name: "Your keys" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Nightly batch");
  await expect(table).toContainText(`${key.slice(0, 6)}`);
  await expect(page.getByText("1 of 10 keys")).toBeVisible();

  const script = await playwright.request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { "x-api-key": key } });
  expect((await script.get("/api/images/00000000-0000-0000-0000-000000000000")).status()).toBe(404);

  await shown.getByRole("button", { name: "Done" }).click();
  await expect(shown).toHaveCount(0);
  await page.reload();
  await expect(page.locator("code", { hasText: key })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Your keys" })).not.toContainText("Not used yet");

  await page.getByRole("button", { name: "Revoke Nightly batch" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Revoke" }).click();
  await expect(dialog).toBeHidden();
  // The dialog closes with the refreshed list, never over the revoked row.
  expect(await page.getByText("No keys yet.").isVisible()).toBe(true);
  expect((await script.get("/api/images/00000000-0000-0000-0000-000000000000")).status()).toBe(401);
  await script.dispose();
});

test("the API keys page fits a phone in Chinese", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto("/zh/api-keys");

  await expect(page.getByRole("heading", { level: 1, name: "API 密钥" })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建密钥" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
