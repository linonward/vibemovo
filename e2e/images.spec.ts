import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { getSession, signIn } from "./support/auth";
import { addFailedImages } from "./support/db";

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/en/images", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fimages");
});

test("the sidebar opens images, off while Bailian isn't set up", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Image generator", exact: true })
    .click();

  await expect(page).toHaveURL("/en/images");
  await expect(page.getByRole("heading", { level: 1, name: "Image generator" })).toBeVisible();
  await expect(page.getByText("Image generation isn't set up yet.")).toBeVisible();
  // signupCredits in src/server/credits/config.ts
  await expect(page.getByText("30 credits left")).toBeVisible();
  await page.getByLabel("Prompt").fill("A red fox");
  await expect(page.getByRole("button", { name: "Generate (1 credit)" })).toBeDisabled();
  await expect(page.getByText("No images yet.")).toBeVisible();
});

test("generating needs a session, then reports images off", async ({ page, request }) => {
  const anonymous = await request.post("/api/images", { data: { prompt: "x", aspect: "1:1" } });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const post = (data: object) =>
    page.request.post("/api/images", { data, headers: { origin: BASE_URL } });

  const invalid = await post({ prompt: " ", aspect: "1:1" });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "INVALID_REQUEST" });

  const off = await post({ prompt: "A red fox", aspect: "1:1" });
  expect(off.status()).toBe(503);
  expect(await off.json()).toEqual({ error: "IMAGES_DISABLED" });

  const missing = await page.request.get("/api/images/00000000-0000-0000-0000-000000000000");
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: "IMAGE_NOT_FOUND" });
});

// CI has no storage, so only the refusals run here. The redirect to a signed
// download URL is covered by src/server/images/index.int.test.ts.
test("downloads need a session and a stored image of one's own", async ({ page, request }) => {
  const unknown = "/api/images/00000000-0000-0000-0000-000000000000/download";
  const anonymous = await request.get(unknown, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const { user } = await getSession(page);
  await addFailedImages(user.id, ["1:1"]);
  await page.goto("/en/images/library");
  const href = await page.getByRole("link", { name: "Seeded 1:1" }).getAttribute("href");
  const id = href!.split("/").at(-1);

  for (const path of [unknown, `/api/images/${id}/download`]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "IMAGE_NOT_FOUND" });
  }
});

test("each image keeps its own height instead of stretching to its row", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  await addFailedImages(user.id, ["16:9", "9:16"]);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/en/images");

  const items = page.getByRole("list", { name: "Your images" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  const [wide, tall] = await Promise.all([items.nth(0).boundingBox(), items.nth(1).boundingBox()]);
  expect(wide!.height).toBeLessThan(tall!.height / 2);
});

test("the library pages through every image from the sidebar", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  // IMAGES_PAGE_SIZE in src/server/images/config.ts, plus one.
  await addFailedImages(user.id, Array.from({ length: 25 }, () => "1:1"));
  await page.goto("/en/images");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "All images" })
    .click();

  await expect(page).toHaveURL("/en/images/library");
  await expect(page.getByRole("heading", { level: 1, name: "All images" })).toBeVisible();
  const items = page.getByRole("list", { name: "All images" }).getByRole("listitem");
  await expect(items).toHaveCount(24);
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL("/en/images/library?page=2");
  await expect(items).toHaveCount(1);

  await page.goto("/en/images/library?page=3");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a card opens the image's page, and unknown images are not found", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  await addFailedImages(user.id, ["9:16"]);
  await page.goto("/en/images/library");

  await page.getByRole("link", { name: "Seeded 9:16" }).click();

  await expect(page).toHaveURL(/\/en\/images\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Image details" })).toBeVisible();
  // Next.js keeps the library page in the DOM, hidden, for the back button.
  const visible = { visible: true };
  await expect(page.getByText("Generation failed. The credit was refunded.").filter(visible)).toBeVisible();
  await expect(page.getByText("Failed", { exact: true }).filter(visible)).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "All images" }).filter(visible).click();
  await expect(page).toHaveURL("/en/images/library");

  await page.goto("/en/images/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("the generator shows the newest 10 images and links to the rest", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  // RECENT_IMAGES in src/server/images/config.ts, plus one.
  await addFailedImages(user.id, Array.from({ length: 11 }, () => "1:1"));
  await page.goto("/en/images");

  await expect(page.getByRole("list", { name: "Your images" }).getByRole("listitem")).toHaveCount(10);

  await page.getByRole("link", { name: "View all" }).click();
  await expect(page).toHaveURL("/en/images/library");
  await expect(page.getByRole("list", { name: "All images" }).getByRole("listitem")).toHaveCount(11);
});
