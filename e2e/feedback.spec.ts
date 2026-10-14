import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { signIn } from "./support/auth";
import { feedbackPng } from "./support/feedback";

test("feedback requires sign-in and administrator access for the list", async ({ page, request }) => {
  const response = await request.get("/en/feedback", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Ffeedback");
  expect((await request.post("/api/feedback", { data: {} })).status()).toBe(401);
  await signIn(page);
  await page.goto("/en/admin/feedback");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("list", { name: "User feedback" })).toHaveCount(0);
});

test("submits Chinese feedback from the mobile corner link", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/dashboard");
  await page.getByRole("link", { name: "意见反馈", exact: true }).click();
  await expect(page).toHaveURL("/zh/feedback");
  await page.getByLabel("图片", { exact: true }).setInputFiles(feedbackPng);
  await expect.poll(() => page.getByAltText("screenshot.png").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await page.getByRole("button", { name: "提交反馈", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("反馈已提交，谢谢。");
  await expect(page.getByLabel("反馈内容")).toHaveValue("");
});

test("validates input, enforces origin and rate limits, and deduplicates retries", async ({ page }) => {
  await signIn(page);
  const data = { message: "Export please", requestId: randomUUID() };
  const post = (body: unknown) => page.request.post("/api/feedback", { data: body, headers: { origin: BASE_URL } });
  expect((await page.request.post("/api/feedback", { data, headers: { origin: "https://other.example" } })).status()).toBe(403);
  for (const body of [null, { ...data, message: " " }, { ...data, message: "x".repeat(2001) }]) {
    expect((await post(body)).status()).toBe(400);
  }
  const first = await post(data);
  const again = await post(data);
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual(await again.json());
  const limited = await post(data);
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
});


test("rejects a disguised SVG and oversized uploads before storage", async ({ page, request }) => {
  expect((await request.get("/api/admin/feedback/missing/images/0", { maxRedirects: 0 })).status()).toBe(401);
  await signIn(page);
  for (const buffer of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), Buffer.alloc(4 * 1024 * 1024 + 1)]) {
    const response = await page.request.post("/api/feedback", {
      headers: { origin: BASE_URL },
      multipart: { message: "Screenshot", requestId: randomUUID(), images: { ...feedbackPng, buffer } },
    });
    expect(response.status()).toBe(400);
  }
});


test("the feedback link stays in the layout's bottom-right corner across pages and scrolling", async ({ page }) => {
  await signIn(page);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const path of ["/en/dashboard", "/en/billing"]) {
      await page.goto(path);
      const link = page.getByRole("link", { name: "Feedback", exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/en/feedback");
      const before = (await link.boundingBox())!;
      const width = await page.evaluate(() => document.documentElement.clientWidth);
      expect(width - before.x - before.width).toBeCloseTo(16, 0);
      expect(viewport.height - before.y - before.height).toBeCloseTo(16, 0);
      expect(before.height).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const after = (await link.boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
    }
    await page.getByRole("link", { name: "Feedback", exact: true }).click();
    await expect(page).toHaveURL("/en/feedback");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const submit = (await page.getByRole("button", { name: "Submit feedback" }).boundingBox())!;
    const link = (await page.getByRole("link", { name: "Feedback", exact: true }).boundingBox())!;
    expect(submit.y + submit.height).toBeLessThan(link.y);
  }
});

test("pastes text and a clipboard image, previews it and submits", async ({ page, context }) => {
  await signIn(page);
  await page.goto("/en/feedback");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const message = page.getByLabel("Your feedback");
  await message.focus();
  await page.evaluate(() => navigator.clipboard.writeText("Pasted feedback"));
  const session = await context.newCDPSession(page);
  // Dispatch Chromium's native paste command so the test is independent of OS shortcuts.
  const paste = async () => {
    await message.click();
    await session.send("Input.dispatchKeyEvent", { type: "keyDown", commands: ["paste"] });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp" });
  };
  await paste();
  await expect(message).toHaveValue("Pasted feedback");

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    canvas.getContext("2d")!.fillRect(0, 0, 1, 1);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((image) => resolve(image!), "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  });
  await message.focus();
  await paste();
  const preview = page.getByRole("img");
  await expect(preview).toHaveCount(1);
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  await expect(message).toHaveValue("Pasted feedback");
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.getByRole("status")).toHaveText("Your feedback has been submitted. Thank you.");
  await expect(preview).toHaveCount(0);
});
