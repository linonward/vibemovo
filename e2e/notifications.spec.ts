import { expect, test } from "@playwright/test";
import { getSession, signIn } from "./support/auth";
import { addFailedImageNotifications } from "./support/db";

test("signed-out visitors are redirected, and the API answers 401", async ({ request }) => {
  const response = await request.get("/en/notifications", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fnotifications");

  expect((await request.get("/api/notifications")).status()).toBe(401);
  expect((await request.post("/api/notifications/read", { data: {} })).status()).toBe(401);
});

test("the bell shows unread notifications and opens one", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  await page.goto("/en/dashboard");
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();

  await addFailedImageNotifications(user.id, 2);
  await page.reload();
  await page.getByRole("button", { name: "Notifications, 2 unread" }).click();

  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /Your image failed/ })).toHaveCount(2);
  await menu.getByRole("menuitem", { name: /Notified 1/ }).click();

  await expect(page).toHaveURL(/\/en\/images\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "Image details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notifications, 1 unread" })).toBeVisible();
});

test("the notifications page pages through every notification and marks them read", async ({ page }) => {
  await signIn(page);
  const { user } = await getSession(page);
  // NOTIFICATIONS_PAGE_SIZE in src/server/notifications/config.ts, plus one.
  await addFailedImageNotifications(user.id, 21);
  await page.goto("/en/dashboard");

  await page.getByRole("button", { name: "Notifications, 21 unread" }).click();
  await page.getByRole("menuitem", { name: "View all" }).click();

  await expect(page).toHaveURL("/en/notifications");
  // The bell's menu has its own Mark all as read, and on a slow machine it
  // is still closing when the page arrives. Wait for it, and use the page's.
  await expect(page.getByRole("menu")).toBeHidden();
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  const items = main.getByRole("list", { name: "Notifications" }).getByRole("listitem");
  await expect(items).toHaveCount(20);
  await expect(main.getByText("Page 1 of 2")).toBeVisible();

  await main.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Mark all as read" })).toBeHidden();

  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL("/en/notifications?page=2");
  await expect(items).toHaveCount(1);
  await expect(items.getByText("Unread")).toHaveCount(0);

  await page.goto("/en/notifications?page=3");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a new user has no notifications", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/notifications");

  await expect(page.getByText("No notifications yet.")).toBeVisible();
});

test.describe("in Shanghai", () => {
  test.use({ timezoneId: "Asia/Shanghai" });

  test("times show in the reader's time zone, not the server's UTC", async ({ page }) => {
    await signIn(page);
    const { user } = await getSession(page);
    await addFailedImageNotifications(user.id, 1);
    await page.goto("/en/notifications");

    const time = page.getByRole("main").locator("time").first();
    const at = new Date((await time.getAttribute("datetime")) as string);
    const local = (timeZone: string) =>
      new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(at);
    await expect(time).toHaveText(local("Asia/Shanghai"));
    expect(local("Asia/Shanghai")).not.toBe(local("UTC"));
  });
});
