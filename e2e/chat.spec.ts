import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { signIn } from "./support/auth";

const SIGNUP_CREDITS = 75;

test("signed-out visitors are redirected to sign-in", async ({ request }) => {
  const response = await request.get("/en/chat", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fchat");
});

test("chat API refuses signed-out requests", async ({ request }) => {
  const response = await request.post("/api/chat", { data: { messages: [] } });

  expect(response.status()).toBe(401);
});

test("opens from the sidebar, streams a reply and charges a credit", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "AI chat" })
    .click();
  await expect(page).toHaveURL("/en/chat");
  await expect(page.getByRole("heading", { level: 1, name: "AI chat" })).toBeVisible();

  await page.getByRole("textbox", { name: "Message" }).fill("hello there");
  await page.getByRole("button", { name: "Send" }).click();

  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText("hello there", { exact: true })).toBeVisible();
  await expect(log.getByText("Echo: hello there")).toBeVisible();

  // The account menu in the sidebar shows the new balance without a reload.
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(
    page.getByRole("menuitem", { name: `${SIGNUP_CREDITS - 1} credits left` }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/en/billing");
  await expect(page.getByText(`${SIGNUP_CREDITS - 1} credits`)).toBeVisible();
});

test("saves the chat: it gets a URL, survives a reload and continues", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/chat");
  const message = page.getByRole("textbox", { name: "Message" });
  const log = page.getByRole("log", { name: "Conversation" });
  const list = page.getByRole("navigation", { name: "Conversations" });

  await message.fill("plan a trip to Kyoto");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(log.getByText("Echo: plan a trip to Kyoto")).toBeVisible();
  await expect(page).toHaveURL(/^.*\/en\/chat\/[0-9a-f-]{36}$/);
  await expect(list.getByRole("link", { name: "plan a trip to Kyoto" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The sidebar still marks the chat page.
  await expect(
    page
      .getByRole("navigation", { name: "Dashboard navigation" })
      .getByRole("link", { name: "AI chat" }),
  ).toHaveAttribute("aria-current", "page");

  await page.reload();
  await expect(log.getByText("Echo: plan a trip to Kyoto")).toBeVisible();

  await message.fill("in autumn");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(log.getByText("Echo: in autumn")).toBeVisible();
  await page.reload();
  await expect(log.getByText("Echo: in autumn")).toBeVisible();
  await expect(log.getByText("Echo: plan a trip to Kyoto")).toBeVisible();

  await list.getByRole("link", { name: "New chat" }).click();
  await expect(page).toHaveURL("/en/chat");
  await expect(log.getByText("Echo: in autumn")).toHaveCount(0);
  await list.getByRole("link", { name: "plan a trip to Kyoto" }).click();
  await expect(log.getByText("Echo: in autumn")).toBeVisible();
});

test("another user's chat is not found", async ({ browser, page }) => {
  await signIn(page);
  const id = randomUUID();
  const message = { id: randomUUID(), role: "user", parts: [{ type: "text", text: "private" }] };
  const headers = { origin: BASE_URL };
  await (await page.request.post("/api/chat", { data: { id, message }, headers })).body();

  const other = await browser.newPage();
  await signIn(other);
  // The page streams, so the status is already 200; the 404 page renders instead.
  await other.goto(`/en/chat/${id}`);
  await expect(other.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(other.getByText("private")).toHaveCount(0);
  const reply = { ...message, id: randomUUID() };
  expect((await other.request.post("/api/chat", { data: { id, message: reply }, headers })).status()).toBe(404);
  expect((await other.request.delete(`/api/chat/${id}`, { headers })).status()).toBe(404);
  await other.close();
});

test("deletes a chat after confirming", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/chat");
  await page.getByRole("textbox", { name: "Message" }).fill("delete me");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/\/en\/chat\/[0-9a-f-]{36}$/);
  const url = page.url();

  await page.getByRole("button", { name: "Delete “delete me”" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL("/en/chat");
  await expect(
    page.getByRole("navigation", { name: "Conversations" }).getByText("delete me"),
  ).toHaveCount(0);
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("asks users without credits to buy more", async ({ page }) => {
  await signIn(page);
  const id = randomUUID();
  for (let i = 0; i < SIGNUP_CREDITS; i++) {
    const message = { id: randomUUID(), role: "user", parts: [{ type: "text", text: "hi" }] };
    const response = await page.request.post("/api/chat", { data: { id, message }, headers: { origin: BASE_URL } });
    expect(response.status()).toBe(200);
    await response.body();
  }
  await page.goto("/en/chat");

  await page.getByRole("textbox", { name: "Message" }).fill("one more");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "You're out of credits." })).toBeVisible();
  await page.getByRole("link", { name: "Buy credits" }).click();
  await expect(page).toHaveURL("/en/billing");
});

test("chat is translated", async ({ page }) => {
  await signIn(page);
  await page.goto("/zh/chat");

  await expect(page.getByRole("heading", { level: 1, name: "AI 对话" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送" })).toBeVisible();
});

test("fits a 375px phone without horizontal scrolling", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/zh/chat");
  await expect(page.getByRole("button", { name: "发送" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("replies render Markdown; the user's message stays as typed", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/chat");

  await page.getByRole("textbox", { name: "Message" }).fill("**bold** and `code`");
  await page.getByRole("button", { name: "Send" }).click();

  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText("**bold** and `code`", { exact: true })).toBeVisible();
  await expect(log.locator("strong", { hasText: "bold" })).toBeVisible();
  await expect(log.locator("code", { hasText: "code" })).toBeVisible();
});

// Cache Components preserves visited pages. Their original balance must
// not replace a newer balance when the user returns after spending.
test("visited generation and billing pages keep the balance after a chat spends a credit", async ({ page }) => {
  await signIn(page);
  const sidebar = page.getByRole("navigation", { name: "Dashboard navigation" });
  const generators = ["Image generator", "Video generator", "Rap duo"];
  for (const name of generators) {
    await sidebar.getByRole("link", { name, exact: true }).click();
    await expect(page.getByText(`${SIGNUP_CREDITS} credits left`, { exact: true }).filter({ visible: true })).toBeVisible();
  }
  await sidebar.getByRole("link", { name: "Credits & billing", exact: true }).click();
  await expect(page.getByText(`${SIGNUP_CREDITS} credits`, { exact: true })).toBeVisible();
  await sidebar.getByRole("link", { name: "AI chat", exact: true }).click();
  await page.getByRole("textbox", { name: "Message" }).fill("balance regression");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("log", { name: "Conversation" }).getByText("Echo: balance regression")).toBeVisible();
  for (const name of generators) {
    await sidebar.getByRole("link", { name, exact: true }).click();
    await expect(page.getByText(`${SIGNUP_CREDITS - 1} credits left`, { exact: true }).filter({ visible: true })).toBeVisible();
  }
  await sidebar.getByRole("link", { name: "Credits & billing", exact: true }).click();
  await expect(page.getByText(`${SIGNUP_CREDITS - 1} credits`, { exact: true })).toBeVisible();
});
