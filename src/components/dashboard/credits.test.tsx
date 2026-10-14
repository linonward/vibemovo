import { afterEach, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CreditsProvider, useCredits } from "./credits";

afterEach(cleanup);

function Probe() {
  const credits = useCredits();
  return (
    <button type="button" onClick={() => credits?.adjust(-2)}>
      {credits?.balance ?? "none"}
    </button>
  );
}

test("adjusts the balance", () => {
  render(
    <CreditsProvider balance={10}>
      <Probe />
    </CreditsProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "10" }));

  expect(screen.getByRole("button", { name: "8" })).toBeTruthy();
});

test("takes a new stored balance from the server", () => {
  const { rerender } = render(
    <CreditsProvider balance={10}>
      <Probe />
    </CreditsProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "10" }));

  rerender(
    <CreditsProvider balance={35}>
      <Probe />
    </CreditsProvider>,
  );

  expect(screen.getByRole("button", { name: "35" })).toBeTruthy();
});

test("is empty outside the dashboard", () => {
  render(<Probe />);

  expect(screen.getByRole("button", { name: "none" })).toBeTruthy();
});
