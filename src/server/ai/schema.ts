import { bigint, index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
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
