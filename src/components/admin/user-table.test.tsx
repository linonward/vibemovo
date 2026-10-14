import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/en${href}`} {...props} />
  ),
}));

const { UserTable } = await import("./user-table");

afterEach(cleanup);

const users = [
  { id: "1", name: "Ada", email: "ada@example.com", createdAt: new Date("2026-01-02T00:00:00Z"), balance: 1250 },
  { id: "2", name: "", email: "lin@example.com", createdAt: new Date("2026-03-04T00:00:00Z"), balance: 0 },
];

test("lists users with email, name, balance and join date", () => {
  renderWithIntl(<UserTable users={users} />);

  const table = screen.getByRole("table", { name: "Users" });
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(3);
  expect(within(rows[1]).getByRole("link", { name: "ada@example.com" }).getAttribute("href")).toBe(
    "/en/admin/users/1",
  );
  expect(within(rows[1]).getByText("Ada")).toBeTruthy();
  expect(within(rows[1]).getByText("Jan 2, 2026")).toBeTruthy();
  expect(within(rows[1]).getByText("1,250")).toBeTruthy();
  expect(within(rows[1]).getByRole("button", { name: "Add credits to ada@example.com" })).toBeTruthy();
  expect(within(rows[2]).getByText("Not set")).toBeTruthy();
});

test("says when no user matches the search", () => {
  renderWithIntl(<UserTable users={[]} query="nobody" />);

  expect(screen.getByText("No users match “nobody”.")).toBeTruthy();
});

test("shows an empty state without users", () => {
  renderWithIntl(<UserTable users={[]} />, "zh");

  expect(screen.getByText("还没有用户。")).toBeTruthy();
});
