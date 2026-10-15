import { expect, test } from "@playwright/test";
import { greyPng } from "./support/images";
import { getSession, randomIp, readMagicLink, uniqueEmail } from "./support/auth";

const photo = (name: string) => ({ name, mimeType: "image/png", buffer: greyPng(320, 320) });

test("a visitor picks photos on a landing page, signs in there and the video starts on return", async ({ page }) => {
  const email = uniqueEmail();
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  await page.goto("/en/hug-your-younger-self-ai");

  const form = page.getByRole("region", { name: "Try it now" });
  const childPreview = form.getByRole("img", { name: "Your childhood photo preview" });
  // A pick before hydration has no handler yet, so repeat it until the preview shows.
  await expect(async () => {
    await form.getByLabel("Your childhood photo").setInputFiles(photo("child.png"));
    await expect(childPreview).toBeVisible({ timeout: 1000 });
  }).toPass();
  await form.getByLabel("Your photo today").setInputFiles(photo("today.png"));
  await form.getByRole("button", { name: "Generate (75 credits)" }).click();

  // Sign-in opens over the page instead of leaving it.
  const dialog = page.getByRole("dialog", { name: "Sign in to make your video" });
  await expect(dialog).toContainText("New accounts get 75 free credits");
  await expect(page).toHaveURL("/en/hug-your-younger-self-ai");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByRole("button", { name: "Send magic link" }).click();
  await expect(dialog.getByText("Check your email")).toBeVisible();

  await page.goto(await readMagicLink(email));

  await expect(page).toHaveURL("/en/hug-your-younger-self-ai");
  expect((await getSession(page))?.user.email).toBe(email);
  // The saved photos come back and go out at once; here videos are off.
  await expect(form.getByRole("img", { name: "Your photo today preview" })).toBeVisible();
  await expect(childPreview).toBeVisible();
  await expect(form.getByRole("alert")).toHaveText("Hug your younger self isn't set up yet.");
});

test("the closing call to action leads back up to the form", async ({ page }) => {
  await page.goto("/en/ai-vampire-transformation-video");

  await page.getByRole("link", { name: "Make a vampire video" }).click();

  await expect(page).toHaveURL("/en/ai-vampire-transformation-video#try");
  await expect(page.getByRole("region", { name: "Try it now" }).getByLabel("Your photo")).toBeInViewport();
});
