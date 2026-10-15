import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, BASE_URL } from "../playwright.config";
import { signIn } from "./support/auth";
import { feedbackPng } from "./support/feedback";
import { addOrders, ensureUsers } from "./support/db";

const ADMIN = ADMIN_EMAIL;
const sidebar = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Dashboard navigation" });

// Every admin test signs in as the same user, through the same outbox file.
test.describe.configure({ mode: "serial" });

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/en/admin", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fadmin");
});

test("non-admins see no admin link and get the 404 page", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");
  await expect(sidebar(page).getByRole("link", { name: "Credits & billing" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Admin" })).toHaveCount(0);

  for (const path of ["/en/admin", "/en/admin/users", "/en/admin/users/some-id", "/en/admin/orders", "/en/admin/metrics"]) {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    // The dashboard layout and the 404 page each add a noindex tag.
    for (const robots of await page.locator('head meta[name="robots"]').all()) {
      await expect(robots).toHaveAttribute("content", /noindex/);
    }
    await expect(page.locator('head meta[name="robots"]').first()).toBeAttached();
  }
});

test("admins open the user list from the sidebar", async ({ page }) => {
  const user = await signIn(page);
  await signIn(page, ADMIN);
  await page.goto("/en/dashboard");

  await sidebar(page).getByRole("link", { name: "Admin" }).click();

  // Admin opens its first sub page.
  await expect(page).toHaveURL("/en/admin/users");
  await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Users" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The list shows the newest 50 users. The admin may be older than that,
  // but the user created just now is not.
  const table = page.getByRole("table", { name: "Users" });
  await expect(table.getByRole("cell", { name: user, exact: true })).toBeVisible();
});

test("admins search users by email and page through the list", async ({ page }) => {
  const user = await signIn(page);
  await signIn(page, ADMIN);
  await page.goto("/en/admin/users");

  const search = page.getByRole("searchbox", { name: "Search users" });
  await search.fill(user.toUpperCase());
  await search.press("Enter");

  await expect(page).toHaveURL(`/en/admin/users?q=${encodeURIComponent(user.toUpperCase())}`);
  const table = page.getByRole("table", { name: "Users" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("cell", { name: user, exact: true })).toBeVisible();
  await expect(search).toHaveValue(user.toUpperCase());

  await search.fill("no-such-user-anywhere");
  await search.press("Enter");
  await expect(page.getByText("No users match “no-such-user-anywhere”.")).toBeVisible();

  // More users than one page holds (50).
  await ensureUsers(51);
  await page.goto("/en/admin/users");
  const pages = page.getByRole("navigation", { name: "Pages" });
  await pages.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL("/en/admin/users?page=2");
  await expect(pages).toContainText("Page 2 of");
  await expect(pages.getByRole("link", { name: "Previous" })).toBeVisible();
});

test("admins open a user's details from the list and add credits there", async ({ page }) => {
  const user = await signIn(page);
  await signIn(page, ADMIN);
  await page.goto(`/en/admin/users?q=${encodeURIComponent(user)}`);

  await page.getByRole("table", { name: "Users" }).getByRole("link", { name: user }).click();

  await expect(page).toHaveURL(/\/en\/admin\/users\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.split("@")[0]);
  await expect(page.getByRole("region", { name: "Profile" })).toContainText(user);
  await expect(page.getByRole("region", { name: "Subscription" })).toContainText(
    "No subscription.",
  );
  await expect(sidebar(page).getByRole("link", { name: "Users" })).not.toHaveAttribute(
    "aria-current",
  );

  await page.getByRole("button", { name: `Add credits to ${user}` }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Credits to add").fill("5");
  await dialog.getByRole("button", { name: "Add" }).click();
  await expect(dialog).toBeHidden();
  // signupCredits in src/server/credits/config.ts
  await expect(page.getByText("35 credits", { exact: true })).toBeVisible();
  const history = page.getByRole("table", { name: "Credit history" });
  await expect(history.getByRole("row").nth(1)).toContainText("Added by an admin");

  await page.getByRole("link", { name: "All users" }).click();
  await expect(page).toHaveURL("/en/admin/users");

  // The user is notified.
  await signIn(page, user);
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await expect(page.getByRole("menuitem", { name: /Credits added/ })).toContainText("5 credits were added.");
});

// Only to one user: a broadcast to everyone would change the unread counts
// other tests expect.
test("admins send a notification to one user, who reads it under the bell", async ({ page }) => {
  const user = await signIn(page);
  const blocked = await page.request.post("/api/admin/broadcasts", {
    data: { title: "x", body: "x", email: user, requestId: "x" },
    headers: { origin: BASE_URL },
  });
  expect(blocked.status()).toBe(404);

  await signIn(page, ADMIN);
  await page.goto("/en/admin/users");
  await sidebar(page).getByRole("link", { name: "Broadcasts" }).click();
  await expect(page).toHaveURL("/en/admin/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Broadcasts" })).toBeVisible();

  await page.getByRole("radio", { name: "One user" }).check({ force: true });
  await page.getByLabel("User's email").fill(user.toUpperCase());
  await page.getByLabel("Title").fill("Maintenance tonight");
  await page.getByLabel("Message").fill("We restart at 02:00 UTC.\nIt takes five minutes.");
  await page.getByRole("button", { name: "Send" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`${user.toUpperCase()} gets it.`);
  await dialog.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("status")).toHaveText("Sent to 1 user.");
  const history = page.getByRole("table", { name: "Sent notifications" });
  await expect(history.getByRole("row").nth(1)).toContainText("Maintenance tonight");
  await expect(history.getByRole("row").nth(1)).toContainText(user);

  await signIn(page, user);
  await page.goto("/en/dashboard");
  await page.getByRole("button", { name: "Notifications, 1 unread" }).click();
  await page.getByRole("menuitem", { name: /Maintenance tonight/ }).click();
  await expect(page).toHaveURL("/en/notifications");
  await expect(page.getByRole("list", { name: "Notifications" })).toContainText("It takes five minutes.");
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});

test("an unknown user id gets the 404 page", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/en/admin/users/no-such-id");

  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("the admin page fits a phone in Chinese", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh/admin/users");

  await expect(page.getByRole("heading", { level: 1, name: "用户" })).toBeVisible();
  await expect(page.getByRole("table", { name: "用户" })).toBeVisible();
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await page.getByRole("table", { name: "用户" }).getByRole("link").first().click();
  await expect(page.getByRole("region", { name: "资料" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("admins add credits to a user, who sees them in their history", async ({ page }) => {
  const user = await signIn(page);
  await signIn(page, ADMIN);
  await page.goto("/en/admin/users");

  const row = page.getByRole("table", { name: "Users" }).getByRole("row").filter({ hasText: user });
  // signupCredits in src/server/credits/config.ts
  await expect(row.getByRole("cell", { name: "30", exact: true })).toBeVisible();
  await row.getByRole("button", { name: `Add credits to ${user}` }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(user);
  await dialog.getByLabel("Credits to add").fill("25");
  await dialog.getByRole("button", { name: "Add" }).click();

  await expect(dialog).toBeHidden();
  // The dialog closes with the refreshed balance, never over the old one.
  expect(await row.getByRole("cell", { name: "55", exact: true }).isVisible()).toBe(true);

  await signIn(page, user);
  await page.goto("/en/billing");
  const latest = page.getByRole("table", { name: "Credit history" }).getByRole("row").nth(1);
  await expect(latest).toContainText("Added by an admin");
  await expect(latest).toContainText("+25");
});

test("the add-credits API answers only admins", async ({ page, request }) => {
  const data = { userId: "x", amount: 5, requestId: "r" };
  expect((await request.post("/api/admin/credits", { data })).status()).toBe(401);

  await signIn(page);
  const post = (body: object) =>
    page.request.post("/api/admin/credits", { data: body, headers: { origin: BASE_URL } });
  expect((await post(data)).status()).toBe(404);

  await signIn(page, ADMIN);
  expect((await post({ ...data, amount: 0 })).status()).toBe(400);
  expect((await post(data)).status()).toBe(404);
});

test("admins list orders, filter them and open the buyer", async ({ page }) => {
  const buyer = await signIn(page);
  await addOrders(buyer, ["paid", "pending", "failed"]);
  await signIn(page, ADMIN);
  await page.goto("/en/admin/users");

  await sidebar(page).getByRole("link", { name: "Orders" }).click();

  await expect(page).toHaveURL("/en/admin/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Orders" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("searchbox", { name: "Search orders" }).fill(buyer);
  await page.getByRole("combobox", { name: "Status" }).selectOption("paid");
  await page.getByRole("button", { name: "Filter" }).click();

  await expect(page).toHaveURL(`/en/admin/orders?q=${encodeURIComponent(buyer)}&status=paid&provider=`);
  await expect(page.getByText("1 order matches these filters.")).toBeVisible();
  const table = page.getByRole("table", { name: "Orders" });
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByRole("row").nth(1)).toContainText("Paid");
  await expect(table.getByRole("row").nth(1)).toContainText("$5.00");

  await page.getByRole("combobox", { name: "Status" }).selectOption("expired");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("No orders match these filters.")).toBeVisible();

  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/en/admin/orders");

  await page.goto(`/en/admin/orders?q=${encodeURIComponent(buyer)}`);
  await table.getByRole("link", { name: buyer }).first().click();
  await expect(page).toHaveURL(/\/en\/admin\/users\/[^/?]+$/);
  await expect(page.getByRole("region", { name: "Profile" })).toContainText(buyer);
});

test("the orders page fits a phone in Chinese", async ({ page }) => {
  const buyer = await signIn(page);
  await addOrders(buyer, ["paid"]);
  await signIn(page, ADMIN);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto(`/zh/admin/orders?q=${encodeURIComponent(buyer)}`);

  await expect(page.getByRole("heading", { level: 1, name: "订单" })).toBeVisible();
  await expect(page.getByRole("table", { name: "订单" })).toContainText("已支付");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("admins open metrics from the sidebar and switch the range", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/en/admin/users");

  await sidebar(page).getByRole("link", { name: "Metrics" }).click();

  await expect(page).toHaveURL("/en/admin/metrics");
  await expect(page.getByRole("heading", { level: 1, name: "Metrics" })).toBeVisible();
  const range = page.getByRole("navigation", { name: "Range" });
  await expect(range.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("group", { name: "New users" })).toBeVisible();
  const table = page.getByRole("table", { name: "Generations" });
  await expect(table.getByRole("rowheader")).toHaveText(["Images", "Videos"]);

  await range.getByRole("link", { name: "30 days" }).click();
  await expect(page).toHaveURL("/en/admin/metrics?days=30");
  await expect(range.getByRole("link", { name: "30 days" })).toHaveAttribute("aria-current", "page");

  // An unknown range shows 7 days.
  await page.goto("/en/admin/metrics?days=365");
  await expect(range.getByRole("link", { name: "7 days" })).toHaveAttribute("aria-current", "page");
});

test("the metrics page fits a phone in Chinese", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto("/zh/admin/metrics");

  await expect(page.getByRole("heading", { level: 1, name: "运营指标" })).toBeVisible();
  await expect(page.getByRole("table", { name: "生成任务" })).toContainText("图片");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("users submit feedback from the corner link and admins read it", async ({ page }) => {
  const email = await signIn(page);
  await page.goto("/en/dashboard");
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await page.getByLabel("Your feedback").fill("Please add export.\nKeep the original format.");
  await page.getByLabel("Images", { exact: true }).setInputFiles(feedbackPng);
  const submitted = page.waitForResponse((response) => response.url().endsWith("/api/feedback") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.getByRole("status")).toHaveText("Your feedback has been submitted. Thank you.");
  const { feedback } = await (await submitted).json();
  const imagePath = `/api/admin/feedback/${feedback.id}/images/0`;
  expect((await page.request.get(imagePath, { maxRedirects: 0 })).status()).toBe(404);
  await signIn(page, ADMIN);
  await page.goto("/en/dashboard");
  await sidebar(page).getByRole("link", { name: "User feedback", exact: true }).click();
  const item = page.getByRole("list", { name: "User feedback" }).getByRole("listitem").filter({ hasText: email });
  await expect(item).toContainText("Please add export.");
  await expect(item).toContainText("Keep the original format.");
  await expect(item.getByRole("link", { name: "Open image 1" })).toBeVisible();
  await expect.poll(() => item.getByAltText("Feedback image 1").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  const image = await page.request.get(imagePath);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect(await image.body()).toEqual(feedbackPng.buffer);
});
