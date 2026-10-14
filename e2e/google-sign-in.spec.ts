import { expect, test } from "@playwright/test";
import { GOOGLE_CLIENT_ID } from "../playwright.config";

test("Continue with Google redirects to Google's consent screen", async ({
  page,
  baseURL,
}) => {
  // Don't hit Google; just capture where the browser was sent.
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ body: "google" }),
  );

  await page.goto("/en/sign-in");
  await page.getByRole("button", { name: "Continue with Google" }).click();

  await page.waitForURL("https://accounts.google.com/**");
  const url = new URL(page.url());
  expect(url.searchParams.get("client_id")).toBe(GOOGLE_CLIENT_ID);
  expect(url.searchParams.get("redirect_uri")).toBe(
    `${baseURL}/api/auth/callback/google`,
  );
});
