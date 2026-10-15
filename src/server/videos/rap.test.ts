import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { recordUsage } from "@/server/ai/usage";
import { defaultLyrics, parseLyrics, rapPrompt, writeLyrics } from "./rap";

vi.mock("@/server/ai/usage", () => ({ recordUsage: vi.fn() }));

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

// A model that answers every request with `text`, and records the prompts.
function model(text: string | Error) {
  const prompts: string[] = [];
  const mock = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      if (text instanceof Error) throw text;
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
  return { mock, prompts };
}

test("the prompt puts 图1 on the left and 图2 on the right, each rapping their line", () => {
  const prompt = rapPrompt(["Line one", "Line two"]);

  expect(prompt).toContain("图1 stands on the LEFT, 图2 stands on the RIGHT");
  expect(prompt).toContain('图1 raps: "Line one"');
  expect(prompt).toContain('图2 raps: "Line two"');
  expect(prompt).toMatch(/^Static tripod camera/);
});

test("parses two lines, dropping numbering and quotes", () => {
  expect(parseLyrics('1. "Ada on the mic, yeah"\n\n2) “Bo keeps it tight”\n')).toEqual([
    "Ada on the mic, yeah",
    "Bo keeps it tight",
  ]);
});

test.each([
  ["one line", "Only one line"],
  ["three lines", "a\nb\nc"],
  ["a line too long", `${"x".repeat(200)}\nshort`],
  ["a quote inside a line", 'He said "hi"\nfine'],
])("rejects %s", (_, text) => {
  expect(parseLyrics(text)).toBeNull();
});

test("the default lines name both performers, in the page's language", () => {
  expect(defaultLyrics(["Ada", "Bo"], "en").join(" ")).toMatch(/Ada.*Bo/);
  expect(defaultLyrics(["小明", "小红"], "zh").join(" ")).toMatch(/小明.*小红/);
});

test("writes the lines with the model, naming both performers in the language", async () => {
  const { mock, prompts } = model("Ada rolls in\nBo runs the block");

  expect(await writeLyrics(["Ada", "Bo"], "zh", mock)).toEqual(["Ada rolls in", "Bo runs the block"]);
  expect(prompts[0]).toContain("Ada");
  expect(prompts[0]).toContain("Bo");
  expect(prompts[0]).toContain("Chinese");
  expect(recordUsage).toHaveBeenCalledWith(mock, "lyrics", expect.objectContaining({ inputTokens: 0 }));
});

test.each([
  ["the model fails", new Error("timeout")],
  ["the reply doesn't parse", "no"],
  ["the reply has a blocked term", "csam line\nsecond"],
])("falls back to the default lines when %s", async (_, reply) => {
  const { mock } = model(reply);

  expect(await writeLyrics(["Ada", "Bo"], "en", mock)).toEqual(defaultLyrics(["Ada", "Bo"], "en"));
});

test("uses the default lines without a model", async () => {
  expect(await writeLyrics(["Ada", "Bo"], "en", null)).toEqual(defaultLyrics(["Ada", "Bo"], "en"));
});
