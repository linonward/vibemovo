import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test("signed-out visitors see the plan, the packs and what credits buy", async ({ page }) => {
  const response = await page.goto("/en/pricing");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL("/en/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();
  await expect(page).toHaveTitle("AI Video Generator Pricing: Credit Packs & Plans | vibemovo");
  const main = page.getByRole("main");
  await expect(main).toContainText("$10.00 per month");
  await expect(main).toContainText("300 credits every month");
  for (const [credits, price] of [["100 credits", "$5.00"], ["450 credits", "$20.00"], ["1,000 credits", "$40.00"]]) {
    await expect(main.getByRole("listitem").filter({ hasText: credits })).toContainText(price);
  }
  await expect(main).toContainText("1 credit per image");
  await expect(main).toContainText("1 credit per chat message");
  await expect(main).toContainText("From 4 credits per second of video");
  await expect(main).toContainText("30 free credits");
});

// Plans and packs read the same way: what you get, what it costs, then the
// button. The terms that hold for every offer of a kind sit under its list.
test("every offer leads with its credits, and each kind's terms follow its list", async ({ page }) => {
  await page.goto("/en/pricing");
  const main = page.getByRole("main");
  const plans = main.getByRole("region", { name: "Subscription" });
  const packs = main.getByRole("region", { name: "Credit packs" });
  // Packs first; the subscription follows them.
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(["Credit packs", "Subscription", "What credits buy"]);

  await expect(plans.getByRole("heading", { level: 3 })).toHaveText(["300 credits every month"]);
  await expect(packs.getByRole("heading", { level: 3 })).toHaveText(["100 credits", "450 credits", "1,000 credits"]);
  for (const item of await main.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 3 }) }).all()) {
    expect(await item.evaluate((li) => li.firstElementChild?.tagName)).toBe("H3");
  }

  await expect(plans.getByRole("listitem")).not.toContainText("Cancel anytime");
  await expect(plans).toContainText("Unused credits carry over. Cancel anytime.");
  await expect(packs.getByRole("listitem").first()).not.toContainText("never expire");
  await expect(packs).toContainText("One-time purchase. Credits never expire.");
});

test("the yearly price stays on one line, its period in smaller type", async ({ page }) => {
  await page.goto("/en/pricing");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Yearly" }).click();

  const price = main.getByRole("region", { name: "Subscription" }).getByText("$108.00 per year");
  const { lines, amount, period } = await price.evaluate((el) => {
    const figure = getComputedStyle(el.firstElementChild!);
    return {
      lines: el.getBoundingClientRect().height / parseFloat(figure.lineHeight),
      amount: parseFloat(figure.fontSize),
      period: parseFloat(getComputedStyle(el).fontSize),
    };
  });
  expect(Math.round(lines)).toBe(1);
  expect(period).toBeLessThan(amount);
});

test("the toggle switches the plans to yearly billing", async ({ page }) => {
  await page.goto("/en/pricing");
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");

  await main.getByRole("button", { name: "Yearly" }).click();

  await expect(main).toContainText("$108.00 per year");
  await expect(main).toContainText("300 credits every month");
  await expect(main).not.toContainText("$10.00 per month");
  await expect(main.getByRole("link", { name: "Subscribe for $108.00 per year" })).toHaveAttribute(
    "href",
    "/en/billing?plan=pro-yearly",
  );
});

test("buying opens billing for a signed-in user", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/pricing");

  await page.getByRole("link", { name: "Buy 450 credits for $20.00" }).click();

  // Billing marks the chosen pack. Payments are off in E2E, so its button is
  // disabled and can't take focus; the card scrolls into view instead.
  await expect(page).toHaveURL("/en/billing?pack=medium");
  const buy = page.getByRole("button", { name: "Buy 450 credits for $20.00" });
  const card = page.getByRole("listitem").filter({ has: buy });
  await expect(card).toContainText("Selected");
  await expect(card).toBeInViewport();
});

test("signed-out visitors keep their choice through sign-in", async ({ page, request }) => {
  await page.goto("/en/pricing");
  await page.getByRole("link", { name: "Subscribe for $10.00 per month" }).click();

  await expect(page).toHaveURL("/en/sign-in?next=%2Fen%2Fbilling%3Fplan%3Dpro");
  const response = await request.get("/en/billing?plan=pro", { maxRedirects: 0 });
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fbilling%3Fplan%3Dpro");
});

test("renders in Chinese, linked from the header", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("banner").getByRole("link", { name: "价格" }).click();

  await expect(page).toHaveURL("/zh/pricing");
  await expect(page.getByRole("heading", { level: 1, name: "价格" })).toBeVisible();
});
