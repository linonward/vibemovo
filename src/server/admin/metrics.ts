import { and, count, desc, eq, gte, inArray, like, lt, ne, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";
import { CHAT_CREDIT_COST } from "@/server/ai/config";
import { usageCosts } from "@/server/ai/usage";
import { creditTransaction } from "@/server/credits/schema";
import { getDb } from "@/server/db";
import { imageCosts, imageMetrics } from "@/server/images";
import { REFUND_REASON } from "@/server/payment/refunds";
import { order } from "@/server/payment/schema";
import { videoCosts, videoMetrics } from "@/server/videos";

export type Metrics = Awaited<ReturnType<typeof getMetrics>>;

// The ranges /admin/metrics offers, in days.
export const METRICS_RANGES = [1, 7, 30] as const;

type Within = (column: AnyPgColumn) => SQL | undefined;

const total = (value: SQL) => sql<number>`coalesce(${value}, 0)`.mapWith(Number);

// How the app did between `since` and `until`: who joined, the credits
// that moved, paid orders and how image and video jobs went. Rows count by
// when they were created; orders by when they were paid.
export async function getMetrics({ since, until = new Date() }: { since: Date; until?: Date }) {
  const db = getDb();
  const within: Within = (column) => and(gte(column, since), lt(column, until));

  const [[users], [newUsers], [credits], [orders], revenue, generations, costs] = await Promise.all([
    db.select({ total: count() }).from(user),
    db.select({ total: count() }).from(user).where(within(user.createdAt)),
    db
      .select({
        // Credits taken back for a refunded payment weren't spent: they
        // count against the credits bought.
        spent: total(
          sql`-sum(${creditTransaction.amount}) filter (where ${creditTransaction.amount} < 0 and ${ne(creditTransaction.reason, REFUND_REASON)})`,
        ),
        refunded: total(sql`sum(${creditTransaction.amount}) filter (where ${like(creditTransaction.reason, "% refund")})`),
        bought: total(
          sql`sum(${creditTransaction.amount}) filter (where ${inArray(creditTransaction.reason, ["purchase", "subscription", REFUND_REASON])})`,
        ),
      })
      .from(creditTransaction)
      .where(within(creditTransaction.createdAt)),
    db
      .select({ paid: count() })
      .from(order)
      .where(and(eq(order.status, "paid"), within(order.paidAt))),
    db
      .select({ currency: order.currency, amount: total(sql`sum(${order.amount})`) })
      .from(order)
      .where(and(eq(order.status, "paid"), within(order.paidAt)))
      .groupBy(order.currency)
      .orderBy(desc(sql`sum(${order.amount})`), order.currency),
    Promise.all([imageMetrics({ since, until }), videoMetrics({ since, until })]),
    modelCosts({ since, until }),
  ]);

  return {
    users: { total: users.total, new: newUsers.total },
    credits,
    orders: { paid: orders.paid, revenue },
    generations,
    costs,
  };
}

// What each model cost between `since` and `until`, estimated from list
// prices: videos per provider and resolution (usage in seconds), images
// (count) and chat-model calls (tokens in and out). Videos and images count
// only jobs that succeeded. A row's costUsd is null without a price; the
// total leaves those out.
async function modelCosts(window: { since: Date; until: Date }) {
  const [videoRows, images, calls] = await Promise.all([videoCosts(window), imageCosts(window), usageCosts(window)]);
  const rows = [
    ...videoRows.map((row) => ({
      kind: "video" as const,
      model: `${row.provider} ${row.resolution}`,
      jobs: row.videos,
      usage: row.seconds,
      credits: row.credits,
      costUsd: row.costUsd,
    })),
    ...(images.images > 0
      ? [{ kind: "image" as const, model: images.model, jobs: images.images, usage: images.images, credits: images.credits, costUsd: images.costUsd }]
      : []),
    ...calls.map((row) => ({
      kind: row.purpose,
      model: row.model,
      jobs: row.calls,
      usage: row.inputTokens + row.outputTokens,
      // Lyrics are part of a rap video, which spends the credits.
      credits: row.purpose === "chat" ? row.calls * CHAT_CREDIT_COST : 0,
      costUsd: row.costUsd,
    })),
  ];
  return { rows, totalUsd: rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The metrics of the last `days` days, up to now.
export function recentMetrics(days: number) {
  const until = new Date();
  return getMetrics({ since: new Date(until.getTime() - days * DAY_MS), until });
}
