import { randomUUID } from "node:crypto";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type LanguageModel,
  simulateReadableStream,
  streamText,
  toUIMessageStream,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { grantCredits, spendCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { bailianChatModel } from "./bailian-chat";
import { ChatNotFoundError, chatHistory, saveMessage } from "./chats";
import { recordUsage } from "./usage";
import {
  CHAT_CREDIT_COST,
  DEFAULT_CHAT_MODEL,
  MAX_CONTEXT_CHARS,
  MAX_MESSAGE_CHARS,
  TITLE_CHARS,
} from "./config";

export { ChatNotFoundError };


const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatDisabledError extends Error {
  constructor() {
    super("Chat is off: DASHSCOPE_API_KEY is not set");
    this.name = "ChatDisabledError";
  }
}

export class InvalidChatError extends Error {
  constructor(reason: string) {
    super(`Invalid chat: ${reason}`);
    this.name = "InvalidChatError";
  }
}

export function chatEnabled(): boolean {
  return Boolean(process.env.DASHSCOPE_API_KEY || process.env.AI_MOCK);
}

// DeepSeek on Bailian when DASHSCOPE_API_KEY is set. Otherwise, with AI_MOCK
// set (E2E), a model that echoes the last message, so tests never call it.
export function chatModel(): LanguageModel {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (apiKey) return bailianChatModel(apiKey, process.env.DASHSCOPE_CHAT_MODEL || DEFAULT_CHAT_MODEL);
  if (process.env.AI_MOCK) return echoModel();
  throw new ChatDisabledError();
}

// Adds the user's message to the chat (creating it on the first message),
// charges CHAT_CREDIT_COST in the same transaction, then streams the reply as a UI message stream
// response for useChat. The reply is saved before the response ends. The
// credit is refunded if the model fails.
export async function streamChat({
  userId,
  chatId,
  message: raw,
  model,
}: {
  userId: string;
  chatId: string;
  message: unknown;
  model?: LanguageModel;
}): Promise<Response> {
  if (!UUID.test(chatId)) throw new InvalidChatError("chat ID must be a UUID");
  const message = await validate(raw);
  const resolved = model ?? chatModel();

  const saved = await chatHistory(chatId);
  if (saved && saved.owner !== userId) throw new ChatNotFoundError();
  const history = saved?.messages ?? [];
  if (history.some((m) => m.id === message.id)) throw new InvalidChatError("message already sent");

  // Generated here, not by the client, so a reused ID can't skip the charge.
  const chargeId = randomUUID();
  const title = text(message).replace(/\s+/g, " ").trim().slice(0, TITLE_CHARS);
  // No committed charge without the question. A failed save rolls back
  // both the balance and ledger; the model runs only after the commit.
  await getDb().transaction(async (tx) => {
    await spendCredits({
      userId,
      amount: CHAT_CREDIT_COST,
      reason: "chat",
      idempotencyKey: `chat:${chargeId}`,
      tx,
    });
    await saveMessage({ userId, chatId, title, message, tx });
  });

  const messages = [...history, message];
  const result = streamText({
    model: resolved,
    messages: await convertToModelMessages(recent(messages)),
    onFinish: ({ totalUsage }) => recordUsage(resolved, "chat", totalUsage),
    onError: async ({ error }) => {
      log.error("chat.failed", { userId, chatId, error });
      await grantCredits({
        userId,
        amount: CHAT_CREDIT_COST,
        reason: "chat refund",
        idempotencyKey: `chat-refund:${chargeId}`,
      });
    },
  });
  // Runs the model to the end even if the browser disconnects, so the reply
  // is still saved.
  void result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: false,
      originalMessages: messages,
      generateMessageId: randomUUID,
      onEnd: async ({ responseMessage }) => {
        if (!text(responseMessage)) return;
        await saveMessage({ userId, chatId, title, message: responseMessage });
      },
    }),
  });
}

async function validate(raw: unknown): Promise<UIMessage> {
  let message: UIMessage;
  try {
    [message] = await validateUIMessages({ messages: [raw] });
  } catch {
    throw new InvalidChatError("malformed message");
  }
  if (message.role !== "user") throw new InvalidChatError("message must be the user's");
  if (message.parts.some((part) => part.type !== "text")) throw new InvalidChatError("text only");
  const length = text(message).trim().length;
  if (length === 0) throw new InvalidChatError("empty message");
  if (length > MAX_MESSAGE_CHARS) throw new InvalidChatError("message too long");
  return message;
}

// The newest messages that fit in MAX_CONTEXT_CHARS, starting with the
// user's. The new message always fits: validate caps it.
function recent(messages: UIMessage[]): UIMessage[] {
  let start = messages.length - 1;
  let used = text(messages[start]).length;
  while (start > 0 && used + text(messages[start - 1]).length <= MAX_CONTEXT_CHARS) {
    start--;
    used += text(messages[start]).length;
  }
  while (messages[start].role !== "user") start++;
  return messages.slice(start);
}

function text(message: UIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function echoModel(): LanguageModel {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const last = prompt.findLast((m) => m.role === "user");
      const text = last?.content.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: `Echo: ${text}` },
            { type: "text-end", id: "1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage: {
                inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 0, text: 0, reasoning: undefined },
              },
            },
          ],
        }),
      };
    },
  });
}
