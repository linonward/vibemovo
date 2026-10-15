import { expect, test } from "vitest";
import { raindancePrompt } from "./raindance";

test("the prompt puts 图1 on the dock and makes 图2 the singer, at golden hour", () => {
  const prompt = raindancePrompt();

  expect(prompt).toContain("图1 waits at the end of the dock");
  expect(prompt).toContain("图2 is the singer");
  expect(prompt).toMatch(/golden hour/i);
});

test("the prompt asks for an original, wordless melody: no real song, artist or lyrics", () => {
  const prompt = raindancePrompt();

  expect(prompt).toMatch(/wordless/i);
  expect(prompt).not.toMatch(/Dave|Tems|Raindance/);
});
