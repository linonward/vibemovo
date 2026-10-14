import { randomUUID } from "node:crypto";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/server/auth/schema";
import { NOTIFICATION_TYPES, type NotificationContent } from "./types";

// One row per notification. The page renders the text from `type` and
// `data`, so it follows the reader's locale.
export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    data: jsonb("data").$type<NotificationContent["data"]>().notNull(),
    // One notification per event, so a retry never sends it twice.
    key: text("key").notNull().unique(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("notification_userId_createdAt_idx").on(table.userId, table.createdAt)],
);

// A notification an admin sent. Each recipient gets a `broadcast`
// notification keyed `broadcast:<id>:<userId>`.
export const broadcast = pgTable(
  "broadcast",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    // One per form submission, so a double click sends once.
    requestId: text("request_id").notNull().unique(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // The one recipient, or null for every user.
    email: text("email"),
    // The admin's email.
    sentBy: text("sent_by").notNull(),
    recipients: integer("recipients").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("broadcast_createdAt_idx").on(table.createdAt)],
);
