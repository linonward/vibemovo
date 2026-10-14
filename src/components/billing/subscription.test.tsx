import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Subscription, type SubscriptionProps } from "./subscription";

const fetchMock = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  assign.mockReset();
});

const plans: SubscriptionProps["plans"] = [{ id: "pro", interval: "month", credits: 1000, amount: 1000, currency: "usd" }];
const both: SubscriptionProps["plans"] = [
  ...plans,
  { id: "pro-yearly", interval: "year", credits: 1000, amount: 10000, currency: "usd" },
];

const current = (fields: Partial<NonNullable<SubscriptionProps["current"]>>) => ({
  interval: "month" as const,
  credits: 1000,
  amount: 1000,
  currency: "usd",
  status: "active" as const,
  currentPeriodEnd: new Date("2026-11-12T00:00:00Z"),
  ...fields,
});

test("offers the plan with its monthly credits and price", () => {
  renderWithIntl(<Subscription plans={plans} current={null} enabled />);

  expect(screen.getByText("1,000 credits every month")).toBeTruthy();
  expect(screen.getByText("Unused credits carry over. Cancel anytime.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Subscribe for $10.00 per month" })).toBeTruthy();
});

test("sends the browser to the subscription checkout", async () => {
  fetchMock.mockResolvedValue(Response.json({ url: "https://checkout.test/sub" }));
  renderWithIntl(<Subscription plans={plans} current={null} enabled />, "zh");

  fireEvent.click(screen.getByRole("button", { name: /10/ }));

  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/sub"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/payment/subscribe",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ planId: "pro", locale: "zh" }) }),
  );
});

test("says so when the checkout can't start", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "CHECKOUT_FAILED" }, { status: 502 }));
  renderWithIntl(<Subscription plans={plans} current={null} enabled />);

  fireEvent.click(screen.getByRole("button", { name: /Subscribe/ }));

  expect((await screen.findByRole("alert")).textContent).toBe("Couldn't start checkout. Try again.");
});

test("says a checkout is already open", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "CHECKOUT_PENDING" }, { status: 409 }));
  renderWithIntl(<Subscription plans={plans} current={null} enabled />);

  fireEvent.click(screen.getByRole("button", { name: /Subscribe/ }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "You already started a subscription checkout. Finish it, or try again in half an hour.",
  );
});

test("turns subscribing off when subscriptions aren't set up", () => {
  renderWithIntl(<Subscription plans={plans} current={null} enabled={false} />);

  expect(screen.getByRole("button", { name: /Subscribe/ }).hasAttribute("disabled")).toBe(true);
});

test.each([
  ["active", "Renews on Nov 12, 2026."],
  ["canceling", "Ends on Nov 12, 2026. You keep your credits."],
  ["past_due", "The last payment failed. Update your card to keep your subscription."],
] as const)("shows a %s subscription", (status, text) => {
  renderWithIntl(<Subscription plans={plans} current={current({ status })} enabled />);

  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Subscribe/ })).toBeNull();
});

test("opens the provider's portal to manage the subscription", async () => {
  fetchMock.mockResolvedValue(Response.json({ url: "https://portal.test/p" }));
  renderWithIntl(<Subscription plans={plans} current={current({})} enabled={false} />);

  fireEvent.click(screen.getByRole("button", { name: "Manage subscription" }));

  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://portal.test/p"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/payment/portal",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ locale: "en" }) }),
  );
});

test("marks the plan chosen on the pricing page and focuses its button", () => {
  renderWithIntl(<Subscription plans={plans} current={null} enabled selected="pro" />, "zh");

  const subscribe = screen.getByRole("button", { name: /10/ });
  expect(document.activeElement).toBe(subscribe);
  expect(screen.getByText("已选")).toBeTruthy();
});

test("offers no billing period choice with monthly plans only", () => {
  renderWithIntl(<Subscription plans={plans} current={null} enabled />);

  expect(screen.queryByRole("group", { name: "Billing period" })).toBeNull();
});

test("offers the monthly plans first, and the yearly ones on request", () => {
  renderWithIntl(<Subscription plans={both} current={null} enabled />);

  expect(screen.getByRole("button", { name: "Monthly" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Subscribe for $10.00 per month" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /per year/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Yearly" }));

  expect(screen.getByRole("button", { name: "Yearly" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Subscribe for $100.00 per year" })).toBeTruthy();
  expect(screen.getByText("$100.00 per year")).toBeTruthy();
  expect(screen.getByText("1,000 credits every month")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /per month/ })).toBeNull();
});

test("subscribes to the yearly plan", async () => {
  fetchMock.mockResolvedValue(Response.json({ url: "https://checkout.test/sub" }));
  renderWithIntl(<Subscription plans={both} current={null} enabled />);

  fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
  fireEvent.click(screen.getByRole("button", { name: "Subscribe for $100.00 per year" }));

  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/sub"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/payment/subscribe",
    expect.objectContaining({ body: JSON.stringify({ planId: "pro-yearly", locale: "en" }) }),
  );
});

test("opens on the yearly plans when the pricing page chose one", () => {
  renderWithIntl(<Subscription plans={both} current={null} enabled selected="pro-yearly" />);

  expect(screen.getByRole("button", { name: "Yearly" }).getAttribute("aria-pressed")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Subscribe for $100.00 per year" }));
});

test("shows a yearly subscription's yearly price and monthly credits", () => {
  renderWithIntl(<Subscription plans={both} current={current({ interval: "year", amount: 10000 })} enabled />);

  expect(screen.getByText("1,000 credits every month")).toBeTruthy();
  expect(screen.getByText("$100.00 per year")).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Billing period" })).toBeNull();
});
