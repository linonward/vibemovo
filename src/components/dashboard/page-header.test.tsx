import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

afterEach(cleanup);

test("shows the title as the page's h1, the description and the action", () => {
  render(<PageHeader title="Billing" description="Buy credits." action={<button type="button">Buy</button>} />);

  expect(screen.getByRole("heading", { level: 1, name: "Billing" })).toBeTruthy();
  expect(screen.getByText("Buy credits.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Buy" })).toBeTruthy();
});

test("description and action are optional", () => {
  const { container } = render(<PageHeader title="Admin" />);

  expect(container.querySelectorAll("p")).toHaveLength(0);
});
