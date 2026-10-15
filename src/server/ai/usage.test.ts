import { expect, test } from "vitest";
import { CNY_TO_USD } from "./config";
import { chatCostUsd } from "./usage";

// deepseek-v4.1-flash on Bailian: 2 / 8 yuan per million tokens at peak, 1 / 4 off-peak.
const yuan = (value: number) => value * CNY_TO_USD;

test("prices tokens at Bailian's Beijing peak rate from 8:00 to 22:00", () => {
  // 09:30 in Beijing.
  const cost = chatCostUsd("deepseek-v4.1-flash", { inputTokens: 1_000_000, outputTokens: 500_000 }, new Date("2026-10-15T01:30:00Z"));

  expect(cost).toBeCloseTo(yuan(2 + 4));
});

test("prices tokens at the off-peak rate from 22:00 to 8:00", () => {
  // 23:00 and 07:59 in Beijing.
  for (const at of ["2026-10-15T15:00:00Z", "2026-10-15T23:59:00Z"]) {
    const cost = chatCostUsd("deepseek-v4.1-flash", { inputTokens: 1_000_000, outputTokens: 1_000_000 }, new Date(at));

    expect(cost, at).toBeCloseTo(yuan(1 + 4));
  }
});

test("has no cost for a model without a price", () => {
  expect(chatCostUsd("mock-model-id", { inputTokens: 10, outputTokens: 10 }, new Date())).toBeNull();
});
