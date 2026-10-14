import { expect, test } from "@playwright/test";
import { getSession, readMagicLink, uniqueEmail } from "./support/auth";

test("signs in with a magic link", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));

  await expect(page).toHaveURL("/en/dashboard");
  expect((await getSession(page))?.user.email).toBe(email);
});

test("returns to the page that asked for sign-in", async ({ page }) => {
  const email = uniqueEmail();

  await page.goto("/en/billing");
  await expect(page).toHaveURL("/en/sign-in?next=%2Fen%2Fbilling");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send magic link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));

  await expect(page).toHaveURL("/en/billing");
});
