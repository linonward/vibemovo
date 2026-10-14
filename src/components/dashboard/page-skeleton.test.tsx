import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { PageSkeleton } from "./page-skeleton";

afterEach(cleanup);

test("announces loading without showing text", () => {
  renderWithIntl(<PageSkeleton />);

  const status = screen.getByRole("status", { name: "Loading…" });
  expect(status.textContent).toBe("");
});

test("draws the page header when the page has none outside it", () => {
  const { container } = renderWithIntl(<PageSkeleton header />);
  const { container: bare } = renderWithIntl(<PageSkeleton />);

  expect(container.querySelectorAll("[data-slot=skeleton]").length).toBe(
    bare.querySelectorAll("[data-slot=skeleton]").length + 2,
  );
});

test("is translated", () => {
  renderWithIntl(<PageSkeleton />, "zh");

  expect(screen.getByRole("status", { name: "加载中…" })).toBeTruthy();
});
