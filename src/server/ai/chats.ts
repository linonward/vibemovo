import type { UIMessage } from "ai";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { type Db, getDb, type Tx } from "@/server/db";
import { chat, chatMessage } from "./schema";

// The chat doesn't exist for this user: it's someone else's.
export class ChatNotFoundError extends Error {
  constructor() {
    super("Chat not found");
    this.name = "ChatNotFoundError";
  }
}

export type ChatSummary = { id: string; title: string; updatedAt: Date };

export type SavedChat = { id: string; title: string; messages: UIMessage[] };

// The list shows this many recent chats.
const LIST_LIMIT = 50;

export function listChats(userId: string): Promise<ChatSummary[]> {
  return getDb()
    .select({ id: chat.id, title: chat.title, updatedAt: chat.updatedAt })
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.updatedAt))
    .limit(LIST_LIMIT);
}

export function countChats(userId: string): Promise<number> {
  return getDb().$count(chat, eq(chat.userId, userId));
}

// A chat's rows joined to its messages, in order, in one query. A chat
// without messages yet gives one row with a null message.
function chatRows(where: SQL | undefined) {
  return getDb()
    .select({
      owner: chat.userId,
      title: chat.title,
      id: chatMessage.id,
      role: chatMessage.role,
      parts: chatMessage.parts,
    })
    .from(chat)
    .leftJoin(chatMessage, eq(chatMessage.chatId, chat.id))
    .where(where)
    .orderBy(asc(chatMessage.seq));
}

function messagesOf(rows: Awaited<ReturnType<typeof chatRows>>): UIMessage[] {
  return rows.flatMap(({ id, role, parts }) => (id && role && parts ? [{ id, role, parts }] : []));
}

// Null when the chat doesn't exist or belongs to someone else.
export async function loadChat(userId: string, chatId: string): Promise<SavedChat | null> {
  const rows = await chatRows(and(eq(chat.id, chatId), eq(chat.userId, userId)));
  if (rows.length === 0) return null;
  return { id: chatId, title: rows[0].title, messages: messagesOf(rows) };
}

// The chat's owner and its messages, or null for a chat that doesn't exist
// yet. One query, so a follow-up message waits for one round trip.
export async function chatHistory(chatId: string): Promise<{ owner: string; messages: UIMessage[] } | null> {
  const rows = await chatRows(eq(chat.id, chatId));
  if (rows.length === 0) return null;
  return { owner: rows[0].owner, messages: messagesOf(rows) };
}

// False when the chat doesn't exist or belongs to someone else.
export async function deleteChat(userId: string, chatId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .returning({ id: chat.id });
  return deleted.length > 0;
}

// Creates the chat on its first message, and moves it to the top of the list.
// Throws ChatNotFoundError if the chat is someone else's, so a request that
// races past streamChat's owner check still can't write into it.
// Joins the caller's transaction when given, so the question and its charge
// commit together. Replies use their own transaction.
export async function saveMessage({
  userId,
  chatId,
  title,
  message,
  tx,
}: {
  userId: string;
  chatId: string;
  title: string;
  message: UIMessage;
  tx?: Tx;
}): Promise<void> {
  const { id, role, parts } = message;
  if (role === "system") throw new RangeError("System messages aren't stored");

  const db: Db | Tx = tx ?? getDb();
  await db.transaction(async (tx) => {
    const [own] = await tx
      .insert(chat)
      .values({ id: chatId, userId, title })
      .onConflictDoUpdate({ target: chat.id, set: { updatedAt: sql`now()` }, setWhere: eq(chat.userId, userId) })
      .returning({ id: chat.id });
    if (!own) throw new ChatNotFoundError();
    await tx
      .insert(chatMessage)
      .values({ chatId, id, role, parts })
      .onConflictDoNothing();
  });
}
