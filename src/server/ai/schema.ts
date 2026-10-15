import { bigint, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { UIMessage } from "ai";
import { user } from "@/server/auth/schema";

// One row per conversation. The browser picks the ID (a UUID) so the URL
// can change before the first reply; the server checks the owner.
export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The start of the first message.
    title: text("title").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Bumped on every message, so the list shows recent chats first.
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("chat_userId_updatedAt_idx").on(table.userId, table.updatedAt)],
);

// Messages in useChat's UIMessage format. IDs are unique per chat only,
// because the browser generates the user's message IDs.
export const chatMessage = pgTable(
  "chat_message",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
    // Keeps messages in order, even when two land in the same millisecond.
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ name: "chat_message_pk", columns: [table.chatId, table.id] }),
    index("chat_message_chatId_seq_idx").on(table.chatId, table.seq),
  ],
);

export const AI_USAGE_PURPOSES = ["chat", "lyrics"] as const;

// One row per call to a chat model (chat replies, rap lyrics), for cost
// metrics. No user: costs are totals, and nothing here outlives an account.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    model: text("model").notNull(),
    purpose: text("purpose", { enum: AI_USAGE_PURPOSES }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    // US dollars at the list price when the call ran; null for a model
    // without a price in CHAT_MODEL_PRICES.
    costUsd: doublePrecision("cost_usd"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("ai_usage_createdAt_idx").on(table.createdAt)],
);
