import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { getSession, signIn } from "./support/auth";
import { addFailedVideos } from "./support/db";
import { greyPng } from "./support/images";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/en/videos", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fvideos");
});

test("the sidebar opens videos, off while no provider is set up", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Video generator", exact: true })
    .click();

  await expect(page).toHaveURL("/en/videos");
  await expect(page.getByRole("heading", { level: 1, name: "Video generator" })).toBeVisible();
  await expect(page.getByText("Video generation isn't set up yet.")).toBeVisible();
  // signupCredits in src/server/credits/config.ts covers a 5-second video, not a 10-second one.
  await expect(page.getByText("30 credits left")).toBeVisible();
  await page.getByLabel("Start image").setInputFiles({ name: "fox.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Start image preview" })).toBeVisible();
  await page.getByLabel("Prompt").fill("The fox runs");
  await expect(page.getByRole("button", { name: "Generate (20 credits)" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Buy credits" })).toBeHidden();
  await page.getByRole("radio", { name: "10 s" }).check({ force: true });
  await expect(page.getByRole("button", { name: "Generate (40 credits)" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Buy credits" })).toBeVisible();
  await expect(page.getByText("No videos yet.")).toBeVisible();
});

test("generating needs a session and an image, then reports videos off", async ({ page, request }) => {
  const multipart = (image: Buffer) => ({
    prompt: "The fox runs",
    duration: "5",
    resolution: "1080p",
    image: { name: "fox.png", mimeType: "image/png", buffer: image },
  });
  const anonymous = await request.post("/api/videos", { multipart: multipart(png) });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const post = (image: Buffer) =>
    page.request.post("/api/videos", { multipart: multipart(image), headers: { origin: BASE_URL } });

  const invalid = await post(Buffer.from("<html>"));
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "INVALID_REQUEST" });

  const off = await post(png);
  expect(off.status()).toBe(503);
  expect(await off.json()).toEqual({ error: "VIDEOS_DISABLED" });

  const missing = await page.request.get("/api/videos/00000000-0000-0000-0000-000000000000");
  expect(missing.status()).toBe(404);
});

test("the library pages through every video from the sidebar and the generator", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  // VIDEOS_PAGE_SIZE in src/server/videos/config.ts, plus one.
  await addFailedVideos(user.id, 25);
  await page.goto("/en/videos");

  await page.getByRole("link", { name: "View all" }).click();
  await expect(page).toHaveURL("/en/videos/library");
  await page.goto("/en/dashboard");
  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "All videos" })
    .click();

  await expect(page).toHaveURL("/en/videos/library");
  await expect(page.getByRole("heading", { level: 1, name: "All videos" })).toBeVisible();
  const items = page.getByRole("list", { name: "All videos" }).getByRole("listitem");
  await expect(items).toHaveCount(24);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL("/en/videos/library?page=2");
  await expect(items).toHaveCount(1);

  await page.goto("/en/videos/library?page=3");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a card opens the video's page, and unknown videos are not found", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  await addFailedVideos(user.id, 1);
  await page.goto("/en/videos/library");

  await page.getByRole("link", { name: "Seeded video 1" }).click();

  await expect(page).toHaveURL(/\/en\/videos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Video details" })).toBeVisible();
  // Next.js keeps the library page in the DOM, hidden, for the back button.
  const visible = { visible: true };
  await expect(page.getByText("Generation failed. The credits were refunded.").filter(visible)).toBeVisible();
  await expect(page.getByText("Failed", { exact: true }).filter(visible)).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "All videos" }).filter(visible).click();
  await expect(page).toHaveURL("/en/videos/library");

  await page.goto("/en/videos/00000000-0000-0000-0000-000000000000");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

// CI has no storage, so only the refusals run here. The signed download URL
// is covered by src/server/videos/index.int.test.ts.
test("downloads need a session and a stored video of one's own", async ({ page, request }) => {
  const unknown = "/api/videos/00000000-0000-0000-0000-000000000000/download";
  expect((await request.get(unknown, { maxRedirects: 0 })).status()).toBe(401);

  await signIn(page);
  const { user } = await getSession(page);
  await addFailedVideos(user.id, 1);
  await page.goto("/en/videos/library");
  const href = await page.getByRole("link", { name: "Seeded video 1" }).getAttribute("href");

  for (const path of [unknown, `/api/videos/${href!.split("/").at(-1)}/download`]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "VIDEO_NOT_FOUND" });
  }
});

test("the sidebar opens the rap duo, off while Bailian is not set up", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/videos");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Rap duo", exact: true })
    .click();

  await expect(page).toHaveURL("/en/videos/rap");
  await expect(page.getByRole("heading", { level: 1, name: "Rap duo" })).toBeVisible();
  await expect(page.getByText("The rap duo isn't set up yet.")).toBeVisible();
  await page.getByLabel("Left photo").setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Left photo preview" })).toBeVisible();
  await page.getByLabel("Left name").fill("Ada");
  await expect(page.getByRole("button", { name: "Generate (75 credits)" })).toBeDisabled();
});

test("a photo too small for Bailian is turned away as soon as it is picked", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/videos/rap");
  const photo = page.getByLabel("Left photo");
  const preview = page.getByRole("img", { name: "Left photo preview" });
  // A pick before hydration has no handler yet, so repeat it until the preview shows.
  await expect(async () => {
    await photo.setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: greyPng(320, 320) });
    await expect(preview).toBeVisible({ timeout: 1000 });
  }).toPass();

  await photo.setInputFiles({ name: "ada.png", mimeType: "image/png", buffer: greyPng(194, 259) });

  await expect(
    page.getByRole("alert").filter({
      hasText: "Use photos 240 to 8,000 pixels on each side, with the long side at most 8 times the short side.",
    }),
  ).toBeVisible();
  await expect(preview).toHaveCount(0);
});

test("a rap video needs a session, two photos and two names, then reports videos off", async ({ page, request }) => {
  const multipart = (image: Buffer) => ({
    name1: "Ada",
    name2: "Bo",
    image1: { name: "ada.png", mimeType: "image/png", buffer: png },
    image2: { name: "bo.png", mimeType: "image/png", buffer: image },
  });
  const anonymous = await request.post("/api/videos/rap", { multipart: multipart(png) });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const post = (body: object) => page.request.post("/api/videos/rap", { multipart: body as never, headers: { origin: BASE_URL } });

  const missing = await post({ name1: "Ada", image1: multipart(png).image1 });
  expect(missing.status()).toBe(400);
  const invalid = await post(multipart(Buffer.from("<html>")));
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "INVALID_REQUEST" });

  const off = await post(multipart(png));
  expect(off.status()).toBe(503);
  expect(await off.json()).toEqual({ error: "VIDEOS_DISABLED" });
});
