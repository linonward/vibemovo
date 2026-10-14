import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { OrderFilters } from "./order-filters";

vi.mock("next/form", () => ({
  default: (props: React.ComponentProps<"form">) => <form {...props} />,
}));

afterEach(cleanup);

test("submits q, status and provider to the orders page, keeping the current values", () => {
  renderWithIntl(
    <OrderFilters action="/en/admin/orders" query="ada" status="paid" provider="waffo" />,
  );

  expect(screen.getByRole("search").getAttribute("action")).toBe("/en/admin/orders");
  const search = screen.getByRole("searchbox", { name: "Search orders" }) as HTMLInputElement;
  expect([search.name, search.value]).toEqual(["q", "ada"]);
  const status = screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement;
  expect([status.name, status.value]).toEqual(["status", "paid"]);
  expect([...status.options].map((o) => o.text)).toEqual([
    "All statuses",
    "Pending",
    "Paid",
    "Expired",
    "Failed",
  ]);
  const provider = screen.getByRole("combobox", { name: "Provider" }) as HTMLSelectElement;
  expect([provider.name, provider.value]).toEqual(["provider", "waffo"]);
  expect([...provider.options].map((o) => o.value)).toEqual(["", "stripe", "waffo"]);
  expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
});

test("offers a reset link only while a filter is set", () => {
  renderWithIntl(<OrderFilters action="/en/admin/orders" query="" />);
  expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  cleanup();

  renderWithIntl(<OrderFilters action="/en/admin/orders" query="" status="failed" />);
  expect(screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")).toBe(
    "/en/admin/orders",
  );
});
