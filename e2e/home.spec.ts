import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test("hero states the value and leads to sign-in", async ({ page }) => {
  await page.goto("/en");

  await expect(page).toHaveTitle("starter – Next.js SaaS starter with AI, credits and payments");
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    "A Next.js SaaS starter with passwordless sign-in, credits, Stripe or Waffo payments, AI chat, images and video, an admin area, and English and Chinese.",
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Everything before your first feature, done.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create your account" }).first().click();
  await expect(page).toHaveURL("/en/sign-in");
});

test("the header offers sign-in to visitors and the dashboard once signed in", async ({
  page,
}) => {
  await page.goto("/en");
  const banner = page.getByRole("banner");
  await expect(banner.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/en/sign-in");

  await signIn(page);
  await page.goto("/en/pricing");
  await expect(banner.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await banner.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL("/en/dashboard");
});

test("landing has features, steps, FAQ and a closing call to action", async ({
  page,
}) => {
  await page.goto("/en");

  for (const name of [
    "What's already built",
    "How it works",
    "Questions",
    "Ready when you are.",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(page.getByText("Product screenshot placeholder")).toBeVisible();
});

test("FAQ answers open on click and include the support email", async ({
  page,
}) => {
  await page.goto("/en");

  const question = page.getByText("How do I contact support?");
  await question.click();

  await expect(
    page.getByRole("main").getByRole("link", { name: "support@example.com" }),
  ).toBeVisible();
});

test("landing is translated", async ({ page }) => {
  await page.goto("/zh");

  await expect(
    page.getByRole("heading", { level: 1, name: "第一个功能之前的事，都做好了。" }),
  ).toBeVisible();
});

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/en");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");

  await expect(page).toHaveURL("/en#main-content");
});

for (const width of [320, 375]) {
  for (const locale of ["en", "zh"]) {
    test(`fits a ${width}px phone in ${locale} without horizontal scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(`/${locale}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("turns off icon motion for reduced motion", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto("/en");

  await expect(page.locator("summary svg.lucide-plus").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.close();
});

test("body uses the Geist font", async ({ page }) => {
  await page.goto("/en");

  await expect(page.locator("body")).toHaveCSS("font-family", /Geist/);
});
