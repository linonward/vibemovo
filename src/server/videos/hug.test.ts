import { expect, test } from "vitest";
import { hugPrompt } from "./hug";

test("the prompt makes 图1 the adult and 图2 the same person as a child, in a family hug", () => {
  const prompt = hugPrompt();

  expect(prompt).toContain("图1 is the person today");
  expect(prompt).toContain("图2 is the same person as a young child");
  expect(prompt).toMatch(/not romantic/i);
});
