import { afterEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { OrderTable, type OrderRow } from "./order-table";

afterEach(cleanup);

const orders: OrderRow[] = [
  {
    id: "3f2a9c1e-0000-4000-8000-000000000001",
    userId: "u1",
    email: "ada@example.com",
    credits: 1200,
    amount: 4000,
    currency: "usd",
    status: "paid",
    provider: "stripe",
    createdAt: new Date("2026-10-01T09:30:00Z"),
  },
  {
    id: "7b1d0e2f-0000-4000-8000-000000000002",
    userId: "u2",
    email: "grace@example.com",
    credits: 100,
    amount: 500,
    currency: "usd",
    status: "pending",
    provider: "waffo",
    createdAt: new Date("2026-10-02T10:00:00Z"),
  },
];

test("shows each order with its buyer, pack, amount, provider and status", () => {
  renderWithIntl(<OrderTable orders={orders} />);

  const table = screen.getByRole("table", { name: "Orders" });
  const [, first, second] = within(table).getAllByRole("row");
  expect(within(first).getByRole("link", { name: "ada@example.com" }).getAttribute("href")).toBe(
    "/en/admin/users/u1",
  );
  expect(within(first).getByText("1,200 credits")).toBeTruthy();
  expect(within(first).getByText("$40.00")).toBeTruthy();
  expect(within(first).getByText("Stripe")).toBeTruthy();
  expect(within(first).getByText("Paid")).toBeTruthy();
  expect(within(first).getByText("3f2a9c1e").getAttribute("title")).toBe(orders[0].id);
  expect(within(second).getByText("Waffo Pancake")).toBeTruthy();
  expect(within(second).getByText("Pending")).toBeTruthy();
});

test("explains an empty list, with or without filters", () => {
  renderWithIntl(<OrderTable orders={[]} />);
  expect(screen.getByText("No orders yet.")).toBeTruthy();
  cleanup();

  renderWithIntl(<OrderTable orders={[]} filtered />);
  expect(screen.getByText("No orders match these filters.")).toBeTruthy();
});

test("renders in Chinese", () => {
  renderWithIntl(<OrderTable orders={orders} />, "zh");

  expect(screen.getByRole("table", { name: "订单" })).toBeTruthy();
  expect(screen.getByText("已支付")).toBeTruthy();
  expect(screen.getByText("1,200 积分")).toBeTruthy();
});
