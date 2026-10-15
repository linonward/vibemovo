import { expect, test } from "@playwright/test";

test("the blog lists each locale's posts, newest first", async ({ page }) => {
  await page.goto("/en/blog");

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page).toHaveTitle("AI Video Guides: Photo to Video and Rap Videos | vibemovo");
  const titles = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(titles).toHaveText([
    "AI Vampire Transformation Video from One Photo",
    "AI Zombie Couple Video: Make a Zombie Love Story",
    "Hotel Lobby Rap Duo: AI Song & Video from Photos",
    "Hug Your Younger Self AI: Make the Hug Video",
    "Raindance AI Trend: Make the Dock Video from Two Photos",
    "How to Make an AI Rap Video of Two People from Photos",
    "How to Turn a Photo into a Video with AI",
  ]);

  await page.goto("/zh/blog");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("还没有文章。");
});

test("the post's old URL redirects to its new one", async ({ page }) => {
  const response = await page.goto("/en/blog/migos-ai-song-video-generator");

  expect(response?.request().redirectedFrom()?.response()).toBeTruthy();
  expect((await response?.request().redirectedFrom()?.response())?.status()).toBe(308);
  await expect(page).toHaveURL("/en/blog/hotel-lobby-rap-duo-video");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hotel Lobby Rap Duo: AI Song & Video from Photos");
});

test("a post shows its title, date and body", async ({ page }) => {
  await page.goto("/en/blog");
  await page.getByRole("link", { name: "How to Turn a Photo into a Video with AI" }).click();

  await expect(page).toHaveURL("/en/blog/photo-to-video-ai");
  await expect(page.getByRole("heading", { level: 1, name: "How to Turn a Photo into a Video with AI" })).toBeVisible();
  await expect(page).toHaveTitle("How to Turn a Photo into a Video with AI | vibemovo");
  await expect(page.getByRole("main").getByRole("time")).toHaveAttribute("datetime", "2026-10-14");
  await expect(page.getByRole("main").getByRole("heading", { level: 2, name: "Write a prompt that moves" })).toBeVisible();
});

test("a post that doesn't exist in a locale gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/photo-to-video-ai");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});

test("the header links to the blog in the current locale", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("banner").getByRole("link", { name: "博客" }).click();

  await expect(page).toHaveURL("/zh/blog");
});

test("a post's tags open a page of the posts with that tag", async ({ page }) => {
  await page.goto("/en/blog/photo-to-video-ai");
  await page.getByRole("main").getByRole("link", { name: "guides" }).click();

  await expect(page).toHaveURL("/en/blog/tags/guides");
  await expect(page.getByRole("heading", { level: 1, name: "Posts tagged “guides”" })).toBeVisible();
  await expect(page).toHaveTitle("Posts tagged “guides” | vibemovo");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "AI Vampire Transformation Video from One Photo",
    "AI Zombie Couple Video: Make a Zombie Love Story",
    "Hotel Lobby Rap Duo: AI Song & Video from Photos",
    "Hug Your Younger Self AI: Make the Hug Video",
    "Raindance AI Trend: Make the Dock Video from Two Photos",
    "How to Make an AI Rap Video of Two People from Photos",
    "How to Turn a Photo into a Video with AI",
  ]);
});

test("a tag no post in the locale has gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/tags/guides");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});
