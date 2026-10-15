import { expect, test } from "vitest";
import { VIDEO_COST_PER_SECOND, VIDEO_RESOLUTIONS } from "@/server/videos/config";
import { CREDIT_PACKS } from "./packs";
import { SUBSCRIPTION_PLANS } from "./plans";

// Every offer must sell a second of video for at least this many times
// what the provider charges for it.
const MIN_MARGIN = 1.5;
// Room for floating-point error, so exactly 1.5 times passes.
const EPSILON = 1e-9;

// Dollars per credit for each offer. A plan grants `credits` every month;
// a yearly one charges `amount` for twelve months.
const offers = [
  ...CREDIT_PACKS.map((pack) => ({ id: pack.id, perCredit: pack.amount / 100 / pack.credits })),
  ...SUBSCRIPTION_PLANS.map((plan) => ({
    id: plan.id,
    perCredit: plan.amount / 100 / (plan.credits * (plan.interval === "year" ? 12 : 1)),
  })),
];

const resolutions = Object.entries(VIDEO_RESOLUTIONS).flatMap(([provider, prices]) =>
  Object.entries(prices).map(([resolution, credits]) => ({ provider, resolution, credits })),
);

test.each(offers)("$id sells every video resolution for at least 1.5 times its cost", ({ perCredit }) => {
  for (const { provider, resolution, credits } of resolutions) {
    const cost = VIDEO_COST_PER_SECOND[provider as keyof typeof VIDEO_COST_PER_SECOND][resolution];
    expect(cost, `${provider} ${resolution} has no cost`).toBeGreaterThan(0);
    expect(credits * perCredit, `${provider} ${resolution}`).toBeGreaterThanOrEqual(cost * MIN_MARGIN - EPSILON);
  }
});

