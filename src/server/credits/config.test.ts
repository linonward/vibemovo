import { expect, test } from "vitest";
import { HUG_CREDITS, RAP_CREDITS, VAMPIRE_CREDITS, ZOMBIE_CREDITS } from "@/server/videos/config";
import { signupCredits } from "./config";

// A visitor who signs up from a landing page can make that page's video once.
test("signup credits pay for one video of any landing page", () => {
  for (const credits of [RAP_CREDITS, ZOMBIE_CREDITS, HUG_CREDITS, VAMPIRE_CREDITS]) {
    expect(signupCredits).toBeGreaterThanOrEqual(credits);
  }
});
