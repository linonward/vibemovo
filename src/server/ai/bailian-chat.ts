import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import { dashscopeBaseUrl } from "./dashscope";

// DeepSeek on Bailian, through DashScope's OpenAI-compatible API, with the
// key that Bailian's images and videos use. The DeepSeek client speaks that
// API; only the base URL changes.
export function bailianChatModel(apiKey: string, modelId: string): LanguageModel {
  return createDeepSeek({
    apiKey,
    baseURL: `${dashscopeBaseUrl()}/compatible-mode/v1`,
    fetch: withoutThinking,
  })(modelId);
}

// Bailian's DeepSeek V4 models think by default, which slows every reply and
// bills the thinking tokens. Bailian turns it off with enable_thinking, which
// the DeepSeek client doesn't send, so add it to each request body.
const withoutThinking: typeof fetch = (input, init) => {
  if (typeof init?.body !== "string") return fetch(input, init);
  const body = { ...JSON.parse(init.body), enable_thinking: false };
  return fetch(input, { ...init, body: JSON.stringify(body) });
};
