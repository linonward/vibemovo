import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ShellSkeleton } from "./shell-skeleton";

afterEach(cleanup);

test("announces loading without showing text", () => {
  renderWithIntl(<ShellSkeleton />);

  const status = screen.getByRole("status", { name: "Loading…" });
  expect(status.textContent).toBe("");
});

test("is translated", () => {
  renderWithIntl(<ShellSkeleton />, "zh");

  expect(screen.getByRole("status", { name: "加载中…" })).toBeTruthy();
});
