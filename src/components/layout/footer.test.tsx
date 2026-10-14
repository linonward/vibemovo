import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Footer } from "./footer";

// The root layout renders dark by default.
beforeEach(() => {
  document.documentElement.className = "dark";
});

afterEach(cleanup);

test("groups support and legal links under headings", () => {
  renderWithIntl(<Footer />);

  const support = screen.getByRole("navigation", { name: "Support" });
  expect(within(support).getByRole("link", { name: "support@example.com" }).getAttribute("href")).toBe(
    "mailto:support@example.com",
  );
  const legal = screen.getByRole("navigation", { name: "Legal" });
  expect(within(legal).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
    "/en/privacy",
    "/en/terms",
    "/en/refund",
  ]);
});

test("shows the brand, a blurb, the copyright and the theme switch", () => {
  renderWithIntl(<Footer />);

  expect(screen.getByRole("link", { name: "starter" }).getAttribute("href")).toBe("/en");
  expect(screen.getByText(/Sign-in, credits, payments and AI/)).toBeDefined();
  expect(screen.getByText("© starter. All rights reserved.")).toBeDefined();
  expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
});

test("is translated", () => {
  renderWithIntl(<Footer />, "zh");

  expect(screen.getByRole("navigation", { name: "支持" })).toBeDefined();
  expect(screen.getByText("© starter，保留所有权利。")).toBeDefined();
});
