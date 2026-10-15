import { expect, test } from "vitest";
import { OBJECT_EFFECTS, objectEffectPrompt } from "./effects";

test.each(OBJECT_EFFECTS)("the %s prompt keeps the camera still and the subject from the image", (effect) => {
  const prompt = objectEffectPrompt(effect);

  expect(prompt).toMatch(/static camera/i);
  expect(prompt).toMatch(/main subject of the image/i);
});
