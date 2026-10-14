import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { UserSearch } from "./user-search";

vi.mock("next/form", () => ({
  default: (props: React.ComponentProps<"form">) => <form {...props} />,
}));

afterEach(cleanup);

test("submits the query as q to the given page and keeps the current query", () => {
  renderWithIntl(<UserSearch action="/en/admin/users" query="ada" />);

  const form = screen.getByRole("search");
  const input = screen.getByRole("searchbox", { name: "Search users" }) as HTMLInputElement;
  expect(form.getAttribute("action")).toBe("/en/admin/users");
  expect(input.name).toBe("q");
  expect(input.value).toBe("ada");
  expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
});
