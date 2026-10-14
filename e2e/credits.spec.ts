import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

// The credit history moved into /billing (next.config.ts redirects).
test("the old credits page redirects to billing", async ({ request }) => {
  const response = await request.get("/en/credits", { maxRedirects: 0 });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/en/billing");
});

test("the credit history fits a phone in Chinese", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/zh/credits");

  await expect(page).toHaveURL("/zh/billing");
  await expect(page.getByRole("heading", { level: 1, name: "积分与账单" })).toBeVisible();
  await expect(page.getByRole("table", { name: "积分记录" })).toContainText("注册赠送");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
