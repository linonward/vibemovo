import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Billing, type BillingProps } from "./billing";

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

const props: BillingProps = {
  balance: 1200,
  enabled: true,
  packs: [
    { id: "small", credits: 100, amount: 500, currency: "usd" },
    { id: "large", credits: 1200, amount: 4000, currency: "usd" },
  ],
  transactions: [
    { id: "2", amount: -30, reason: "export", createdAt: new Date("2026-10-12T00:00:00Z") },
    { id: "1", amount: 10, reason: "signup", createdAt: new Date("2026-10-10T00:00:00Z") },
  ],
  orders: [
    { id: "o1", credits: 1200, amount: 4000, currency: "usd", status: "paid", createdAt: new Date("2026-10-01") },
  ],
};

test("shows the balance, packs and past orders", () => {
  renderWithIntl(<Billing {...props} />);

  expect(screen.getByText("Credit balance").nextElementSibling?.textContent).toBe("1,200 credits");
  expect(screen.getByRole("button", { name: "Buy 100 credits for $5.00" })).toBeTruthy();
  const orders = screen.getByRole("table", { name: "Orders" });
  expect(within(orders).getByText("Paid")).toBeTruthy();
  expect(within(orders).getByText("$40.00")).toBeTruthy();
});

test("lists the credit history on the same page", () => {
  renderWithIntl(<Billing {...props} />);

  const rows = within(screen.getByRole("table", { name: "Credit history" })).getAllByRole("row");
  expect(rows).toHaveLength(3);
  // Unknown reasons show as stored.
  expect(within(rows[1]).getByText("export")).toBeTruthy();
  expect(within(rows[1]).getByText("−30")).toBeTruthy();
  expect(within(rows[2]).getByText("Signup bonus")).toBeTruthy();
});

test("sends the browser to the checkout URL for the chosen pack", async () => {
  fetchMock.mockResolvedValue(Response.json({ url: "https://checkout.test/s" }));
  renderWithIntl(<Billing {...props} />, "zh");

  fireEvent.click(screen.getByRole("button", { name: /100/ }));

  await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.test/s"));
  expect(fetchMock).toHaveBeenCalledWith("/api/payment/checkout", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ packId: "small", locale: "zh" }),
  }));
});

test("says so when checkout can't start", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "CHECKOUT_FAILED" }, { status: 502 }));
  renderWithIntl(<Billing {...props} />);

  fireEvent.click(screen.getByRole("button", { name: /100 credits/ }));

  expect((await screen.findByRole("alert")).textContent).toBe("Couldn't start checkout. Try again.");
  expect(assign).not.toHaveBeenCalled();
});

test("turns buying off when payments aren't set up", () => {
  renderWithIntl(<Billing {...props} enabled={false} />);

  expect(screen.getByText("Payments aren't set up yet.")).toBeTruthy();
  expect(screen.getByRole("button", { name: /100 credits/ }).hasAttribute("disabled")).toBe(true);
});

test("confirms a finished checkout and an empty history", () => {
  renderWithIntl(<Billing {...props} orders={[]} transactions={[]} checkout="success" />);

  expect(screen.getByRole("status").textContent).toMatch(/Payment received/);
  expect(screen.getByText("No orders yet.")).toBeTruthy();
  expect(screen.getByText("No credit activity yet.")).toBeTruthy();
});

test("marks the pack chosen on the pricing page and focuses its button", () => {
  renderWithIntl(<Billing {...props} selected="large" />);

  const buy = screen.getByRole("button", { name: "Buy 1,200 credits for $40.00" });
  expect(document.activeElement).toBe(buy);
  expect(within(buy.closest("li")!).getByText("Selected")).toBeTruthy();
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("ignores an unknown pack", () => {
  renderWithIntl(<Billing {...props} selected="huge" />);

  expect(screen.queryByText("Selected")).toBeNull();
  expect(document.activeElement).toBe(document.body);
});
