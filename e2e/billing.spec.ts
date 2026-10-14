import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { BASE_URL, STRIPE_WEBHOOK_SECRET } from "../playwright.config";
import { readEmail, signIn } from "./support/auth";
import { addSubscription } from "./support/db";

test("signed-out visitors are redirected before the page renders", async ({ request }) => {
  const response = await request.get("/en/billing", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/en/sign-in?next=%2Fen%2Fbilling");
});

test("the sidebar opens billing with the balance, the packs and the credit history", async ({ page }) => {
  await signIn(page);
  await page.goto("/en/dashboard");

  await page
    .getByRole("navigation", { name: "Dashboard navigation" })
    .getByRole("link", { name: "Credits & billing" })
    .click();

  await expect(page).toHaveURL("/en/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Credits & billing" })).toBeVisible();
  // signupCredits in src/server/credits/config.ts
  await expect(page.getByText("Credit balance").locator("+ p")).toHaveText("10 credits");
  await expect(page.getByRole("button", { name: "Buy 100 credits for $5.00" })).toBeDisabled();
  await expect(page.getByText("Payments aren't set up yet.")).toBeVisible();
  await expect(page.getByText("No orders yet.")).toBeVisible();
  const rows = page.getByRole("table", { name: "Credit history" }).getByRole("row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("Signup bonus");
  await expect(rows.nth(1)).toContainText("+10");
});

test("offers the subscription plan, off while payments aren't set up", async ({ page }) => {
  await signIn(page);

  await page.goto("/en/billing");

  await expect(page.getByRole("heading", { name: "Subscription" })).toBeVisible();
  await expect(page.getByText("300 credits every month")).toBeVisible();
  await expect(page.getByRole("button", { name: "Subscribe for $10.00 per month" })).toBeDisabled();
});

test("opens on the yearly plan chosen on the pricing page", async ({ page }) => {
  await signIn(page);

  await page.goto("/en/billing?plan=pro-yearly");

  await expect(page.getByRole("button", { name: "Yearly" })).toHaveAttribute("aria-pressed", "true");
  const subscribe = page.getByRole("button", { name: "Subscribe for $100.00 per year" });
  await expect(subscribe).toBeDisabled();
  await expect(page.getByRole("listitem").filter({ has: subscribe })).toContainText("Selected");
});

test("subscribing and the portal need a session and a subscription", async ({ page, request }) => {
  for (const endpoint of ["/api/payment/subscribe", "/api/payment/portal"]) {
    expect((await request.post(endpoint, { data: {} })).status(), endpoint).toBe(401);
  }

  await signIn(page);
  const post = (endpoint: string, data: object) =>
    page.request.post(endpoint, { data, headers: { origin: BASE_URL } });

  const subscribe = await post("/api/payment/subscribe", { planId: "pro", locale: "en" });
  expect(subscribe.status()).toBe(503);
  expect(await subscribe.json()).toEqual({ error: "PAYMENTS_DISABLED" });

  const portal = await post("/api/payment/portal", { locale: "en" });
  expect(portal.status()).toBe(404);
  expect(await portal.json()).toEqual({ error: "NO_SUBSCRIPTION" });
});

test("shows the result of a checkout the provider sent back", async ({ page }) => {
  await signIn(page);

  await page.goto("/zh/billing?checkout=cancel");

  await expect(page.getByRole("status")).toHaveText("已取消支付，未扣款。");
});

test("checkout needs a session, then reports payments off", async ({ page, request }) => {
  const anonymous = await request.post("/api/payment/checkout", { data: { packId: "small" } });
  expect(anonymous.status()).toBe(401);

  await signIn(page);
  const response = await page.request.post("/api/payment/checkout", {
    data: { packId: "small", locale: "en" },
    headers: { origin: BASE_URL },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "PAYMENTS_DISABLED" });
});

test.describe("payment webhooks", () => {
  const event = (type: string, object: object) =>
    JSON.stringify({ id: "evt_e2e", object: "event", type, data: { object } });
  const payload = event("checkout.session.expired", { client_reference_id: crypto.randomUUID() });
  const signed = (body: string) =>
    Stripe.webhooks.generateTestHeaderString({ payload: body, secret: STRIPE_WEBHOOK_SECRET });

  test("accept an event Stripe signed", async ({ request }) => {
    const response = await request.post("/api/webhooks/payment/stripe", {
      data: payload,
      headers: { "content-type": "application/json", "stripe-signature": signed(payload) },
    });

    expect(response.status()).toBe(200);
  });

  // Every order is recorded before its checkout, so Stripe should retry.
  test("answer 409 to a signed payment for an order this app never recorded", async ({ request }) => {
    const paid = event("checkout.session.completed", {
      client_reference_id: crypto.randomUUID(),
      payment_status: "paid",
    });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: paid,
      headers: { "content-type": "application/json", "stripe-signature": signed(paid) },
    });

    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: "UNKNOWN_ORDER" });
  });

  test("accept a signed invoice for a subscription this app doesn't know", async ({ request }) => {
    const invoice = JSON.stringify({
      id: "evt_e2e_invoice",
      object: "event",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_e2e",
          customer: "cus_e2e",
          parent: { subscription_details: { subscription: "sub_e2e", metadata: { subscriptionId: crypto.randomUUID() } } },
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: invoice, secret: STRIPE_WEBHOOK_SECRET });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: invoice,
      headers: { "content-type": "application/json", "stripe-signature": signature },
    });

    expect(response.status()).toBe(200);
  });

  test("email the subscriber when a charge fails, with a link to billing", async ({ page, request }) => {
    const email = await signIn(page);
    const subscriptionId = await addSubscription(email);
    const failed = event("customer.subscription.updated", {
      id: "sub_e2e",
      status: "past_due",
      metadata: { subscriptionId },
    });

    const response = await request.post("/api/webhooks/payment/stripe", {
      data: failed,
      headers: { "content-type": "application/json", "stripe-signature": signed(failed) },
    });
    expect(response.status()).toBe(200);

    const { text } = await readEmail(email, /payment didn't go through/);
    const link = text.match(/https?:\/\/\S+/)?.[0];
    expect(link).toBe(`${BASE_URL}/billing`);
    await page.goto(link!);
    await expect(page).toHaveURL(/\/en\/billing$/);
  });

  test("reject an unsigned event", async ({ request }) => {
    for (const provider of ["stripe", "waffo"]) {
      const response = await request.post(`/api/webhooks/payment/${provider}`, {
        data: payload,
        headers: { "content-type": "application/json" },
      });
      expect(response.status(), provider).toBe(400);
    }
  });

  test("404 for an unknown provider", async ({ request }) => {
    const response = await request.post("/api/webhooks/payment/paypal", { data: payload });

    expect(response.status()).toBe(404);
  });
});
