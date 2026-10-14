import { randomUUID } from "node:crypto";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";

export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    message: text("message").notNull(),
    images: jsonb("images").$type<{ key: string; mime: string }[]>().default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feedback_userId_requestId_idx").on(table.userId, table.requestId),
    index("feedback_createdAt_id_idx").on(table.createdAt, table.id),
  ],
);
