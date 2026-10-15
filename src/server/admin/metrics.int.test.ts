import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { CNY_TO_USD } from "@/server/ai/config";
import { aiUsage } from "@/server/ai/schema";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { creditTransaction } from "@/server/credits/schema";
import { getDb } from "@/server/db";
import { image } from "@/server/images/schema";
import { order } from "@/server/payment/schema";
import { video } from "@/server/videos/schema";
import { getMetrics, recentMetrics } from "./metrics";

const cleanup: string[] = [];

afterEach(async () => {
  const ctx = await auth.$context;
  // Deleting a user deletes their rows.
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

// Each test counts a window of its own in the past, so rows other tests
// write now never fall in it.
function window() {
  const since = new Date(Date.UTC(2001, 0, 1) + Math.floor(Math.random() * 1e6) * 60_000);
  return { since, until: new Date(since.getTime() + 60 * 60_000), at: (minutes: number) => new Date(since.getTime() + minutes * 60_000) };
}

async function createUser(createdAt?: Date) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    { email: `metrics-${randomUUID()}@example.com`, name: "Metrics" },
    { method: "admin" },
  );
  cleanup.push(created.id);
  if (createdAt) await getDb().update(user).set({ createdAt }).where(eq(user.id, created.id));
  return created.id;
}

test("counts users who joined in the window, and every user", async () => {
  const { since, until, at } = window();
  await createUser(at(5));
  await createUser(at(50));
  await createUser(at(70));

  const metrics = await getMetrics({ since, until });

  expect(metrics.users.new).toBe(2);
  expect(metrics.users.total).toBeGreaterThanOrEqual(3);
});

test("sums the credits spent, refunded and bought, less refunded payments, in the window", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const entry = (amount: number, reason: string, minutes: number) => ({
    userId,
    amount,
    reason,
    idempotencyKey: randomUUID(),
    createdAt: at(minutes),
  });
  await getDb()
    .insert(creditTransaction)
    .values([
      entry(-1, "image", 1),
      entry(-20, "video", 2),
      entry(20, "video refund", 3),
      entry(100, "purchase", 4),
      entry(300, "subscription", 5),
      entry(10, "admin", 6),
      entry(-100, "refunded payment", 7),
      entry(-5, "chat", 90),
    ]);

  const { credits } = await getMetrics({ since, until });

  expect(credits).toEqual({ spent: 21, refunded: 20, bought: 300 });
});

test("counts orders paid in the window and their revenue per currency", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const paid = (amount: number, currency: string, minutes: number, status: "paid" | "pending" = "paid") => ({
    userId,
    packId: "small",
    credits: 100,
    amount,
    currency,
    status,
    provider: "stripe" as const,
    providerSessionId: randomUUID(),
    createdAt: at(minutes),
    paidAt: status === "paid" ? at(minutes) : null,
  });
  await getDb()
    .insert(order)
    .values([paid(500, "usd", 1), paid(1500, "usd", 2), paid(900, "cny", 3), paid(500, "usd", 4, "pending"), paid(500, "usd", 80)]);

  const { orders } = await getMetrics({ since, until });

  expect(orders).toEqual({
    paid: 3,
    revenue: [
      { currency: "usd", amount: 2000 },
      { currency: "cny", amount: 900 },
    ],
  });
});

test("reports each kind's outcomes, timings and most common failures", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const img = (status: "pending" | "succeeded" | "failed", minutes: number, seconds?: number, error?: string) => ({
    userId,
    prompt: "x",
    aspect: "1:1" as const,
    status,
    error,
    createdAt: at(minutes),
    completedAt: seconds === undefined ? null : new Date(at(minutes).getTime() + seconds * 1000),
  });
  await getDb()
    .insert(image)
    .values([
      img("succeeded", 1, 10),
      img("succeeded", 2, 20),
      img("succeeded", 3, 30),
      img("succeeded", 4, 40),
      img("failed", 5, 5, "Bailian 400 DataInspectionFailed"),
      img("failed", 6, 5, "Bailian 400 DataInspectionFailed"),
      img("failed", 7, 5, "Never submitted"),
      img("pending", 8),
      img("succeeded", 90, 1),
    ]);
  await getDb().insert(video).values({
    userId,
    prompt: "x",
    duration: 5,
    provider: "fal",
    resolution: "720p",
    credits: 40,
    status: "succeeded",
    createdAt: at(1),
    completedAt: at(3),
  });

  const { generations } = await getMetrics({ since, until });

  expect(generations).toEqual([
    {
      kind: "image",
      total: 8,
      succeeded: 4,
      failed: 3,
      pending: 1,
      medianMs: 25_000,
      p95Ms: 38_500,
      errors: [
        { error: "Bailian 400 DataInspectionFailed", count: 2 },
        { error: "Never submitted", count: 1 },
      ],
    },
    { kind: "video", total: 1, succeeded: 1, failed: 0, pending: 0, medianMs: 120_000, p95Ms: 120_000, errors: [] },
  ]);
});

test("estimates each model's cost from the jobs that succeeded and the calls made", async () => {
  const { since, until, at } = window();
  const userId = await createUser(at(-10));
  const clip = (status: "succeeded" | "failed", resolution: string, duration: number, minutes: number) => ({
    userId,
    prompt: "x",
    duration,
    provider: "dashscope" as const,
    resolution,
    credits: (resolution === "720p" ? 5 : 8) * duration,
    status,
    createdAt: at(minutes),
  });
  await getDb()
    .insert(video)
    .values([
      clip("succeeded", "720p", 15, 1),
      clip("succeeded", "720p", 5, 2),
      clip("succeeded", "1080p", 10, 3),
      clip("failed", "720p", 15, 4),
      clip("succeeded", "720p", 5, 90),
    ]);
  await getDb()
    .insert(image)
    .values([
      { userId, prompt: "x", aspect: "1:1", status: "succeeded", createdAt: at(5) },
      { userId, prompt: "x", aspect: "1:1", status: "succeeded", createdAt: at(6) },
      { userId, prompt: "x", aspect: "1:1", status: "failed", createdAt: at(7) },
    ]);
  await getDb()
    .insert(aiUsage)
    .values([
      { model: "deepseek-v4.1-flash", purpose: "chat", inputTokens: 100, outputTokens: 50, costUsd: 0.001, createdAt: at(8) },
      { model: "deepseek-v4.1-flash", purpose: "chat", inputTokens: 200, outputTokens: 50, costUsd: 0.002, createdAt: at(9) },
      { model: "deepseek-v4.1-flash", purpose: "lyrics", inputTokens: 40, outputTokens: 20, costUsd: 0.0005, createdAt: at(10) },
      { model: "deepseek-v4.1-flash", purpose: "chat", inputTokens: 999, outputTokens: 999, costUsd: 1, createdAt: at(90) },
    ]);

  const { costs } = await getMetrics({ since, until });

  const rows = costs.rows.map(({ costUsd, ...row }) => ({ ...row, costUsd: costUsd === null ? null : Number(costUsd.toFixed(6)) }));
  expect(rows).toEqual([
    { kind: "video", model: "dashscope 1080p", jobs: 1, usage: 10, credits: 80, costUsd: 1.5 },
    { kind: "video", model: "dashscope 720p", jobs: 2, usage: 20, credits: 100, costUsd: 2 },
    { kind: "image", model: "wan2.6-t2i", jobs: 2, usage: 2, credits: 2, costUsd: Number((2 * 0.2 * CNY_TO_USD).toFixed(6)) },
    { kind: "chat", model: "deepseek-v4.1-flash", jobs: 2, usage: 400, credits: 2, costUsd: 0.003 },
    { kind: "lyrics", model: "deepseek-v4.1-flash", jobs: 1, usage: 60, credits: 0, costUsd: 0.0005 },
  ]);
  expect(costs.totalUsd).toBeCloseTo(1.5 + 2 + 2 * 0.2 * CNY_TO_USD + 0.003 + 0.0005);
});

test("reports zeros for an empty window", async () => {
  const { since, until } = window();

  const metrics = await getMetrics({ since, until });

  expect(metrics.users.new).toBe(0);
  expect(metrics.credits).toEqual({ spent: 0, refunded: 0, bought: 0 });
  expect(metrics.orders).toEqual({ paid: 0, revenue: [] });
  expect(metrics.generations).toEqual([
    { kind: "image", total: 0, succeeded: 0, failed: 0, pending: 0, medianMs: null, p95Ms: null, errors: [] },
    { kind: "video", total: 0, succeeded: 0, failed: 0, pending: 0, medianMs: null, p95Ms: null, errors: [] },
  ]);
  expect(metrics.costs).toEqual({ rows: [], totalUsd: 0 });
});

// Counts only, as other test files create and delete users meanwhile: a
// user created just now must fall in the window recentMetrics builds.
test("recent metrics count up to now", async () => {
  await createUser();

  expect((await recentMetrics(1)).users.new).toBeGreaterThanOrEqual(1);
  // Not total >= new: the two counts are separate queries, and other test
  // files add and delete users between them.
  expect((await recentMetrics(1)).users.total).toBeGreaterThanOrEqual(1);
});
