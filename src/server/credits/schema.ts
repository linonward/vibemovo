import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";

// One row per user. The check constraint is what stops a spend from
// overdrawing, even when spends race.
export const creditBalance = pgTable(
  "credit_balance",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    balance: integer("balance").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [check("credit_balance_non_negative", sql`${table.balance} >= 0`)],
);

// Append-only ledger. A grant has a positive amount, a spend a negative one.
export const creditTransaction = pgTable(
  "credit_transaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // listTransactions reads a user's newest rows.
    index("credit_transaction_userId_createdAt_idx").on(table.userId, table.createdAt),
    check("credit_transaction_amount_nonzero", sql`${table.amount} <> 0`),
  ],
);
