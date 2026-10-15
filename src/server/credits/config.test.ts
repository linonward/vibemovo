import { expect, test } from "vitest";
import { RAP_CREDITS } from "@/server/videos/config";
import { PHOTO_EFFECTS } from "@/server/videos/photo-effects";
import { signupCredits } from "./config";

// A visitor who signs up from a landing page can make that page's video once.
test("signup credits pay for one video of any landing page", () => {
  for (const credits of [RAP_CREDITS, ...PHOTO_EFFECTS.map((effect) => effect.credits)]) {
    expect(signupCredits).toBeGreaterThanOrEqual(credits);
  }
});
