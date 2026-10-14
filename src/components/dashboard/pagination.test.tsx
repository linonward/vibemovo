import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Pagination } from "./pagination";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    ...props
  }: Omit<React.ComponentProps<"a">, "href"> & { href: { pathname: string; query: Record<string, string> } }) => (
    <a href={`/en${href.pathname}?${new URLSearchParams(href.query)}`} {...props} />
  ),
}));

afterEach(cleanup);

test("links to the pages around the current one", () => {
  renderWithIntl(<Pagination pathname="/videos/library" page={2} pageCount={3} />);

  expect(screen.getByRole("navigation", { name: "Pages" })).toBeTruthy();
  expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("/en/videos/library?page=1");
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/en/videos/library?page=3");
});

test("has no link past either end, and nothing for one page", () => {
  renderWithIntl(<Pagination pathname="/images/library" page={1} pageCount={2} />);
  expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
  cleanup();

  const { container } = renderWithIntl(<Pagination pathname="/images/library" page={1} pageCount={1} />);
  expect(container.innerHTML).toBe("");
});

test("renders in Chinese", () => {
  renderWithIntl(<Pagination pathname="/images/library" page={1} pageCount={2} />, "zh");

  expect(screen.getByRole("navigation", { name: "分页" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "下一页" })).toBeTruthy();
});
