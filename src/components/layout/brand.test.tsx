import { afterEach, expect, test } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { Brand } from "./brand";

afterEach(cleanup);

test("shows the logo mark next to the name, and the link is named by the name alone", () => {
  renderWithIntl(<Brand />);

  const link = screen.getByRole("link", { name: "vibemovo" });
  expect(link.getAttribute("href")).toBe("/en");
  const mark = link.querySelector("svg");
  expect(mark?.getAttribute("aria-hidden")).toBe("true");
  expect(mark?.querySelectorAll("path, rect, circle").length).toBeGreaterThan(0);
});
