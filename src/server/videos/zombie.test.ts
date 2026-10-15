import { expect, test } from "vitest";
import { zombiePrompt } from "./zombie";

test("the prompt places 图1 left and 图2 right and turns both into zombies without gore", () => {
  const prompt = zombiePrompt();

  expect(prompt).toContain("图1 stands on the LEFT");
  expect(prompt).toContain("图2 stands on the RIGHT");
  expect(prompt).toMatch(/zombie/i);
  expect(prompt).toMatch(/no blood/i);
});
