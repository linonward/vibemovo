import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { UserPagination } from "./user-pagination";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: { pathname: string; query: Record<string, string> } }) => (
    <a href={`/en${href.pathname}?${new URLSearchParams(href.query)}`} {...props} />
  ),
}));

afterEach(cleanup);

test("links to the pages before and after, keeping the query", () => {
  renderWithIntl(<UserPagination page={2} pageCount={3} query="ada" />);

  expect(screen.getByRole("navigation", { name: "Pages" })).toBeTruthy();
  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
    "/en/admin/users?q=ada&page=1",
  );
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
    "/en/admin/users?q=ada&page=3",
  );
});

test("has no link past the first or last page and drops an empty query", () => {
  renderWithIntl(<UserPagination page={1} pageCount={2} query="" />);

  expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
    "/en/admin/users?page=2",
  );
});

test("renders nothing for a single page", () => {
  const { container } = renderWithIntl(<UserPagination page={1} pageCount={1} query="" />);

  expect(container.innerHTML).toBe("");
});
