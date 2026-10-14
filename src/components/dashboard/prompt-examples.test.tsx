import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { PromptExamples } from "./prompt-examples";

afterEach(cleanup);

const examples = [
  { label: "Flower shop", prompt: "A flower shop with wooden windows" },
  { label: "Night city", prompt: "A neon city street at night" },
];

test("lists each example as a button and passes its prompt on click", () => {
  const onPick = vi.fn<(prompt: string) => void>();
  renderWithIntl(<PromptExamples examples={examples} onPick={onPick} />);

  const group = screen.getByRole("group", { name: "Examples" });
  expect(group).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Night city" }));

  expect(onPick).toHaveBeenCalledWith("A neon city street at night");
});

test("shows the full prompt as the button's title", () => {
  renderWithIntl(<PromptExamples examples={examples} onPick={() => {}} />);

  expect(screen.getByRole("button", { name: "Flower shop" }).getAttribute("title")).toBe(
    "A flower shop with wooden windows",
  );
});
