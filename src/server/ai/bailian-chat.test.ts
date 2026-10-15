// @vitest-environment node
import { generateText } from "ai";
import { afterEach, expect, test, vi } from "vitest";
import { bailianChatModel } from "./bailian-chat";

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

function reply(content: string) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 1,
      model: "deepseek-v4.1-flash",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content, reasoning_content: "" } }],
      usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

test("calls DeepSeek on Bailian's OpenAI-compatible API, with thinking off", async () => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("DASHSCOPE_BASE_URL", "https://dashscope-intl.aliyuncs.com/");
  fetchMock.mockResolvedValue(reply("ok"));

  const { text } = await generateText({ model: bailianChatModel("sk-test", "deepseek-v4.1-flash"), prompt: "Reply with: ok" });

  expect(text).toBe("ok");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
  expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-test");
  expect(JSON.parse(init.body)).toMatchObject({ model: "deepseek-v4.1-flash", enable_thinking: false });
});
