import { afterEach, expect, test, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { AccountLink, SiteHeader } from "./site-header";

// The locale switcher reads the current path, which jsdom doesn't provide.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/",
}));

afterEach(cleanup);

test("signed-out visitors get a sign-in button", () => {
  renderWithIntl(<SiteHeader account={<AccountLink signedIn={false} />} />);

  const banner = screen.getByRole("banner");
  expect(within(banner).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
    "/en/sign-in",
  );
  expect(within(banner).queryByRole("link", { name: "Dashboard" })).toBeNull();
});

test("signed-in users get a dashboard button", () => {
  renderWithIntl(<SiteHeader account={<AccountLink signedIn />} />);

  const banner = screen.getByRole("banner");
  expect(within(banner).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
    "/en/dashboard",
  );
  expect(within(banner).queryByRole("link", { name: "Sign in" })).toBeNull();
});

test("both buttons are translated", () => {
  renderWithIntl(
    <>
      <AccountLink signedIn={false} />
      <AccountLink signedIn />
    </>,
    "zh",
  );

  expect(screen.getByRole("link", { name: "登录" }).getAttribute("href")).toBe("/zh/sign-in");
  expect(screen.getByRole("link", { name: "控制台" }).getAttribute("href")).toBe("/zh/dashboard");
});
