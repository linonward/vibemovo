import { expect, test } from "vitest";
import { vampirePrompt } from "./vampire";

test("the prompt turns 图1 into a vampire in 10 seconds, without gore", () => {
  const prompt = vampirePrompt();

  expect(prompt).toContain("图1");
  expect(prompt).not.toContain("图2");
  expect(prompt).toContain("0 to 4 seconds");
  expect(prompt).toMatch(/no blood/i);
});
