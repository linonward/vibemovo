import { randomUUID } from "node:crypto";
import { simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getBalance, InsufficientCreditsError, listTransactions, spendCredits } from "@/server/credits";
import { signupCredits } from "@/server/credits/config";
import { ChatDisabledError, ChatNotFoundError, InvalidChatError, streamChat } from "./chat";
import { chatHistory, countChats, deleteChat, listChats, loadChat, saveMessage } from "./chats";
import { CHAT_CREDIT_COST } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function createUser() {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Test User" },
    { method: "admin" },
  );
  return user.id;
}

const ask = (text: string) => ({ id: randomUUID(), role: "user", parts: [{ type: "text", text }] });

// Replies with how many messages the model saw, and the last one.
function countingModel() {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const last = prompt.at(-1);
      const text = last?.role === "user" && last.content[0]?.type === "text" ? last.content[0].text : "";
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: `${prompt.length}: ${text}` },
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

const failingModel = () =>
  new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("provider down");
    },
  });

const texts = (messages: { role: string; parts: { type: string; text?: string }[] }[]) =>
  messages.map((m) => `${m.role}: ${m.parts.map((p) => p.text ?? "").join("")}`);

const send = async (...args: Parameters<typeof streamChat>) => (await streamChat(...args)).text();

test("charges a credit, streams the reply and saves both messages", async () => {
  vi.stubEnv("DASHSCOPE_API_KEY", "");
  vi.stubEnv("AI_MOCK", "1");
  const userId = await createUser();
  const id = randomUUID();

  expect(await send({ userId, chatId: id, message: ask("hello there") })).toContain(
    "Echo: hello there",
  );

  expect(await getBalance(userId)).toBe(signupCredits - CHAT_CREDIT_COST);
  const saved = await loadChat(userId, id);
  expect(saved?.title).toBe("hello there");
  expect(texts(saved!.messages)).toEqual(["user: hello there", "assistant: Echo: hello there"]);
});

test("continues a saved conversation with its history", async () => {
  const userId = await createUser();
  const id = randomUUID();
  const model = countingModel();

  await send({ userId, chatId: id, message: ask("first"), model });
  await send({ userId, chatId: id, message: ask("second"), model });

  const saved = await loadChat(userId, id);
  expect(texts(saved!.messages)).toEqual([
    "user: first",
    "assistant: 1: first",
    "user: second",
    "assistant: 3: second",
  ]);
  expect(saved?.title).toBe("first");
});

test("sends the model only as much recent history as fits the budget", async () => {
  const userId = await createUser();
  const id = randomUUID();
  const model = countingModel();
  for (let i = 0; i < 6; i++) {
    await send({ userId, chatId: id, message: ask(`${i}`.repeat(4_000)), model });
  }

  const reply = texts((await loadChat(userId, id))!.messages).at(-1)!;
  const seen = Number(reply.match(/^assistant: (\d+):/)?.[1]);
  // Six user messages of 4,000 characters don't all fit in 20,000.
  expect(seen).toBeLessThan(11);
  // The oldest message the model sees is always the user's.
  expect(seen % 2).toBe(1);
});

test("titles a chat with the start of its first message", async () => {
  const userId = await createUser();

  await send({ userId, chatId: randomUUID(), message: ask(`  ${"word ".repeat(30)}`), model: countingModel() });

  const [summary] = await listChats(userId);
  expect(summary.title).toHaveLength(60);
  expect(summary.title.startsWith("word word")).toBe(true);
});

test("lists a user's chats, most recent first, and only theirs", async () => {
  const userId = await createUser();
  const other = await createUser();
  const [a, b] = [randomUUID(), randomUUID()];
  const model = countingModel();

  await send({ userId, chatId: a, message: ask("a"), model });
  await send({ userId, chatId: b, message: ask("b"), model });
  await send({ userId, chatId: a, message: ask("a again"), model });
  await send({ userId: other, chatId: randomUUID(), message: ask("other"), model });

  expect((await listChats(userId)).map((c) => c.id)).toEqual([a, b]);
});

test("counts only the user's chats", async () => {
  const userId = await createUser();
  const other = await createUser();
  const model = countingModel();

  await send({ userId, chatId: randomUUID(), message: ask("a"), model });
  await send({ userId, chatId: randomUUID(), message: ask("b"), model });
  await send({ userId: other, chatId: randomUUID(), message: ask("other"), model });

  expect(await countChats(userId)).toBe(2);
  expect(await countChats(other)).toBe(1);
});

// streamChat reads the owner and the history in one query.
test("reads a chat's owner and its messages in order, or null for a new chat", async () => {
  const userId = await createUser();
  const id = randomUUID();
  const first = ask("first") as UIMessage;
  const second = ask("second") as UIMessage;
  await saveMessage({ userId, chatId: id, title: "t", message: first });
  await saveMessage({ userId, chatId: id, title: "t", message: second });

  expect(await chatHistory(id)).toEqual({ owner: userId, messages: [first, second] });
  expect(await chatHistory(randomUUID())).toBeNull();
});

test("someone else's chat is not found", async () => {
  const owner = await createUser();
  const intruder = await createUser();
  const id = randomUUID();
  await send({ userId: owner, chatId: id, message: ask("mine"), model: countingModel() });

  await expect(
    streamChat({ userId: intruder, chatId: id, message: ask("let me in"), model: countingModel() }),
  ).rejects.toThrow(ChatNotFoundError);
  expect(await loadChat(intruder, id)).toBeNull();
  expect(await deleteChat(intruder, id)).toBe(false);
  expect(await getBalance(intruder)).toBe(signupCredits);
  expect((await loadChat(owner, id))?.messages).toHaveLength(2);
});

// streamChat checks the owner before it saves, but a second request can
// create the chat in between. The save itself must refuse it.
test("never saves a message into someone else's chat", async () => {
  const owner = await createUser();
  const intruder = await createUser();
  const id = randomUUID();
  await send({ userId: owner, chatId: id, message: ask("mine"), model: countingModel() });
  const before = await listChats(owner);

  await expect(
    saveMessage({ userId: intruder, chatId: id, title: "late", message: ask("let me in") as UIMessage }),
  ).rejects.toThrow(ChatNotFoundError);
  expect((await loadChat(owner, id))?.messages).toHaveLength(2);
  expect(await listChats(owner)).toEqual(before);
});

test("deletes a chat and its messages", async () => {
  const userId = await createUser();
  const id = randomUUID();
  await send({ userId, chatId: id, message: ask("bye"), model: countingModel() });

  expect(await deleteChat(userId, id)).toBe(true);
  expect(await loadChat(userId, id)).toBeNull();
  expect(await listChats(userId)).toEqual([]);
});

test("refuses without credits, before calling the model or saving", async () => {
  const userId = await createUser();
  await spendCredits({ userId, amount: signupCredits, reason: "test", idempotencyKey: randomUUID() });
  const model = new MockLanguageModelV4();

  await expect(streamChat({ userId, chatId: randomUUID(), message: ask("hi"), model })).rejects.toThrow(
    InsufficientCreditsError,
  );
  expect(model.doStreamCalls).toHaveLength(0);
  expect(await listChats(userId)).toEqual([]);
});

test.each([false, true])("rolls back the charge when saving fails (existing chat: %s)", async (existing) => {
  const userId = await createUser();
  const chatId = randomUUID();
  if (existing) await send({ userId, chatId, message: ask("first"), model: countingModel() });
  const balance = await getBalance(userId);
  const ledger = await listTransactions(userId);
  const saved = await loadChat(userId, chatId);
  const chats = await listChats(userId);
  const model = countingModel();
  // Valid to the message parser, but PostgreSQL text rejects a zero byte.
  // This fails the message insert after the chat and charge have been written.
  const message = { ...ask("next"), id: "invalid\u0000id" };

  await expect(streamChat({ userId, chatId, message, model })).rejects.toMatchObject({
    cause: expect.objectContaining({ code: "22021" }),
  });

  expect(await getBalance(userId)).toBe(balance);
  expect(await listTransactions(userId)).toEqual(ledger);
  expect(await loadChat(userId, chatId)).toEqual(saved);
  expect(await listChats(userId)).toEqual(chats);
  expect(model.doStreamCalls).toHaveLength(0);
});

test("refunds the credit when the model fails and keeps the question", async () => {
  const userId = await createUser();
  const id = randomUUID();

  await send({ userId, chatId: id, message: ask("hi"), model: failingModel() });

  expect(await getBalance(userId)).toBe(signupCredits);
  expect(texts((await loadChat(userId, id))!.messages)).toEqual(["user: hi"]);
});

test("rejects malformed requests before charging", async () => {
  const userId = await createUser();
  const model = new MockLanguageModelV4();
  const id = randomUUID();
  const sent = ask("once");
  await send({ userId, chatId: id, message: sent, model: countingModel() });
  const balance = await getBalance(userId);

  for (const [chatId, message] of [
    ["not-a-uuid", ask("hi")],
    [randomUUID(), "not a message"],
    [randomUUID(), { id: "1", role: "assistant", parts: [{ type: "text", text: "hi" }] }],
    [randomUUID(), ask("   ")],
    [randomUUID(), ask("x".repeat(4_001))],
    // The same message twice, e.g. a retried request.
    [id, sent],
  ] as const) {
    await expect(streamChat({ userId, chatId, message, model })).rejects.toThrow(InvalidChatError);
  }
  expect(await getBalance(userId)).toBe(balance);
  expect(model.doStreamCalls).toHaveLength(0);
});

test("is off without a Bailian key", async () => {
  vi.stubEnv("DASHSCOPE_API_KEY", "");
  vi.stubEnv("AI_MOCK", "");
  const userId = await createUser();

  await expect(streamChat({ userId, chatId: randomUUID(), message: ask("hi") })).rejects.toThrow(
    ChatDisabledError,
  );
  expect(await getBalance(userId)).toBe(signupCredits);
});
