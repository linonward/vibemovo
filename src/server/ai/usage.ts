import { and, count, gte, lt, sql } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { CHAT_MODEL_PRICES, CNY_TO_USD } from "./config";
import { AI_USAGE_PURPOSES, aiUsage } from "./schema";

export type AiUsagePurpose = (typeof AI_USAGE_PURPOSES)[number];
type Tokens = { inputTokens: number; outputTokens: number };

// Bailian's peak hours, 8:00 to 22:00 in Beijing (UTC+8, no daylight saving).
function isPeak(at: Date): boolean {
  const hour = (at.getUTCHours() + 8) % 24;
  return hour >= 8 && hour < 22;
}

// What a call cost in US dollars at the list price, or null for a model
// without a price.
export function chatCostUsd(model: string, { inputTokens, outputTokens }: Tokens, at: Date): number | null {
  const prices = Object.hasOwn(CHAT_MODEL_PRICES, model) ? CHAT_MODEL_PRICES[model] : null;
  if (!prices) return null;
  const rate = isPeak(at) ? "peak" : "offPeak";
  const yuan = (inputTokens * prices.input[rate] + outputTokens * prices.output[rate]) / 1_000_000;
  return yuan * CNY_TO_USD;
}

// Records one model call's tokens and cost. Never throws: a lost row only
// leaves the cost metrics short.
export async function recordUsage(
  model: LanguageModel,
  purpose: AiUsagePurpose,
  usage: { inputTokens?: number; outputTokens?: number },
): Promise<void> {
  const modelId = typeof model === "string" ? model : model.modelId;
  const tokens = { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 };
  const now = new Date();
  try {
    await getDb()
      .insert(aiUsage)
      .values({ model: modelId, purpose, ...tokens, costUsd: chatCostUsd(modelId, tokens, now), createdAt: now });
  } catch (error) {
    log.error("ai.usage_not_recorded", { model: modelId, purpose, error });
  }
}

// Calls, tokens and cost per model and purpose between `since` and `until`.
// costUsd is null when no call had a price.
export async function usageCosts({ since, until }: { since: Date; until: Date }) {
  return getDb()
    .select({
      model: aiUsage.model,
      purpose: aiUsage.purpose,
      calls: count(),
      inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)`.mapWith(Number),
      outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)`.mapWith(Number),
      costUsd: sql<number | null>`sum(${aiUsage.costUsd})`.mapWith((value) => (value === null ? null : Number(value))),
    })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, since), lt(aiUsage.createdAt, until)))
    .groupBy(aiUsage.model, aiUsage.purpose)
    .orderBy(aiUsage.model, aiUsage.purpose);
}
