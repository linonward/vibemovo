import { randomUUID } from "node:crypto";
import { index, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";
import { PLAN_INTERVALS } from "./plans";
import { PROVIDER_IDS, SUBSCRIPTION_STATUSES } from "./providers/types";

// One row per Checkout attempt. Pack details are copied in, so changing a
// pack later doesn't rewrite past orders.
export const order = pgTable(
  "order",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packId: text("pack_id").notNull(),
    credits: integer("credits").notNull(),
    // In the currency's smallest unit, e.g. cents.
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: ["pending", "paid", "expired", "failed"] })
      .default("pending")
      .notNull(),
    // Which provider took the payment, and its checkout session ID. The row
    // is written before the checkout exists, so the ID is null until then.
    provider: text("provider", { enum: PROVIDER_IDS }).notNull(),
    providerSessionId: text("provider_session_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
  },
  (table) => [
    index("order_userId_idx").on(table.userId),
    unique("order_provider_session_unique").on(table.provider, table.providerSessionId),
  ],
);

// One row per subscription checkout. Plan details are copied in, so
// changing a plan later doesn't change what existing subscribers get.
export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull(),
    // How often the provider charges. Rows from before yearly plans are monthly.
    interval: text("interval", { enum: PLAN_INTERVALS }).default("month").notNull(),
    // Granted every paid month, whatever the interval.
    credits: integer("credits").notNull(),
    // Per billing period, in the currency's smallest unit.
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).default("pending").notNull(),
    provider: text("provider", { enum: PROVIDER_IDS }).notNull(),
    // Null until the checkout exists, as for orders.
    providerSessionId: text("provider_session_id"),
    // Set by webhooks once the provider has created them.
    providerSubscriptionId: text("provider_subscription_id"),
    providerCustomerId: text("provider_customer_id"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("subscription_userId_idx").on(table.userId),
    unique("subscription_provider_session_unique").on(table.provider, table.providerSessionId),
  ],
);
