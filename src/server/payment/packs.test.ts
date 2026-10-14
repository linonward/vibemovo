import { expect, test } from "vitest";
import { RAP_CREDITS } from "@/server/videos/config";
import { CREDIT_PACKS } from "./packs";

test("packs sell rap videos at $9.90 each, cheaper the more you buy", () => {
  expect(CREDIT_PACKS.map(({ id, credits, amount, videos, discount }) => ({ id, credits, amount, videos, discount }))).toEqual([
    { id: "video-1", credits: 75, amount: 990, videos: 1, discount: 0 },
    { id: "video-3", credits: 225, amount: 2673, videos: 3, discount: 10 },
    { id: "video-5", credits: 375, amount: 4208, videos: 5, discount: 15 },
    { id: "video-10", credits: 750, amount: 7920, videos: 10, discount: 20 },
  ]);
  for (const pack of CREDIT_PACKS) expect(pack.credits).toBe(pack.videos * RAP_CREDITS);
});
