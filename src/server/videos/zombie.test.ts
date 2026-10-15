import { expect, test } from "vitest";
import { zombiePrompt } from "./zombie";

test("the prompt makes 图1 the survivor and 图2 the infected partner, without gore", () => {
  const prompt = zombiePrompt();

  expect(prompt).toContain("图1 is the survivor");
  expect(prompt).toContain("图2 is the infected partner");
  expect(prompt).toMatch(/no blood/i);
});
