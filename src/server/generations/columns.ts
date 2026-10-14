import { randomUUID } from "node:crypto";
import type { BuildColumns } from "drizzle-orm";
import { type PgTableWithColumns, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";

export const GENERATION_STATUSES = ["pending", "succeeded", "failed"] as const;

// The columns every kind of generation has. Each kind's table spreads them
// in and adds its own; the lifecycle reads and writes only these.
export function generationColumns() {
  return {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: GENERATION_STATUSES }).default("pending").notNull(),
    // The finished file in object storage.
    storageKey: text("storage_key"),
    // Why generation failed, for operators. Never shown to users.
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    // When the sweep last asked the provider about it. The sweep asks about
    // the least recently checked first, so a backlog takes turns.
    checkedAt: timestamp("checked_at"),
  };
}

// A table with only the shared columns, so the lifecycle can type its
// queries without knowing the kinds.
export type GenerationTable = PgTableWithColumns<{
  name: "generation";
  schema: undefined;
  dialect: "pg";
  columns: BuildColumns<"generation", ReturnType<typeof generationColumns>, "pg">;
}>;
export type GenerationRow = GenerationTable["$inferSelect"];
