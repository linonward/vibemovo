import { withSession } from "@/app/api/_lib/with-session";
import { apiError } from "@/lib/api";
import {
  ChatDisabledError,
  ChatNotFoundError,
  InvalidChatError,
  streamChat,
} from "@/server/ai/chat";
import { InsufficientCreditsError } from "@/server/credits";
import { log } from "@/server/log";

// Streams a chat reply for useChat and saves the conversation.
// Body: { id, message }, the chat's UUID and the user's new message.
// Costs one credit.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const chatId = typeof body.id === "string" ? body.id : "";

  try {
    return await streamChat({ userId: session.user.id, chatId, message: body.message });
  } catch (error) {
    if (error instanceof InvalidChatError) {
      return apiError("INVALID_CHAT", 400);
    }
    if (error instanceof ChatNotFoundError) {
      return apiError("CHAT_NOT_FOUND", 404);
    }
    if (error instanceof InsufficientCreditsError) {
      return apiError("INSUFFICIENT_CREDITS", 402);
    }
    if (error instanceof ChatDisabledError) {
      return apiError("CHAT_DISABLED", 503);
    }
    log.error("chat.failed", { userId: session.user.id, chatId, error });
    return apiError("CHAT_FAILED", 502);
  }
});
