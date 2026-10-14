import { expect, test } from "@playwright/test";

test("the blog lists each locale's posts, newest first", async ({ page }) => {
  await page.goto("/en/blog");

  await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  await expect(page).toHaveTitle("Blog · vibemovo");
  const titles = page.getByRole("main").getByRole("heading", { level: 2 });
  await expect(titles).toHaveText([
    "How to Make an AI Rap Video of Two People from Photos",
    "Writing a post",
    "Welcome to the blog",
  ]);

  await page.goto("/zh/blog");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(["欢迎来到博客"]);
});

test("a post shows its title, date and body", async ({ page }) => {
  await page.goto("/en/blog");
  await page.getByRole("link", { name: "Welcome to the blog" }).click();

  await expect(page).toHaveURL("/en/blog/welcome");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to the blog" })).toBeVisible();
  await expect(page).toHaveTitle("Welcome to the blog · vibemovo");
  await expect(page.getByRole("main").getByRole("time")).toHaveAttribute("datetime", "2026-10-01");
  await expect(page.getByRole("main")).toContainText("content/blog/<locale>/");
});

test("a post that doesn't exist in a locale gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/writing-a-post");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});

test("the header links to the blog in the current locale", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("banner").getByRole("link", { name: "博客" }).click();

  await expect(page).toHaveURL("/zh/blog");
});

test("a post's tags open a page of the posts with that tag", async ({ page }) => {
  await page.goto("/en/blog/writing-a-post");
  await page.getByRole("main").getByRole("link", { name: "guides" }).click();

  await expect(page).toHaveURL("/en/blog/tags/guides");
  await expect(page.getByRole("heading", { level: 1, name: "Posts tagged “guides”" })).toBeVisible();
  await expect(page).toHaveTitle("Posts tagged “guides” · vibemovo");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "How to Make an AI Rap Video of Two People from Photos",
    "Writing a post",
  ]);
});

test("tags work in every locale's own words", async ({ page }) => {
  await page.goto("/zh/blog");
  await page.getByRole("main").getByRole("link", { name: "公告" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "标签为“公告”的文章" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText(["欢迎来到博客"]);
});

test("a tag no post in the locale has gets the 404 page", async ({ page }) => {
  await page.goto("/zh/blog/tags/guides");

  await expect(page.getByRole("heading", { level: 1, name: "页面不存在" })).toBeVisible();
});
