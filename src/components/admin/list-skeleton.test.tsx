import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ListSkeleton } from "./list-skeleton";

afterEach(cleanup);

test("announces loading without showing text", () => {
  renderWithIntl(<ListSkeleton controls="search" columns={["w-40", "w-16"]} />);

  const status = screen.getByRole("status", { name: "Loading…" });
  expect(status.textContent).toBe("");
});

test("is translated", () => {
  renderWithIntl(<ListSkeleton controls="filters" columns={["w-40"]} />, "zh");

  expect(screen.getByRole("status", { name: "加载中…" })).toBeTruthy();
});
