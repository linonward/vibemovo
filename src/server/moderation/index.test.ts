// @vitest-environment node
import { expect, test } from "vitest";
import { blockedTerm, checkPrompt, ContentBlockedError } from "./index";

const terms = ["child porn", "csam", "儿童色情"];

test("finds a blocked phrase whatever its case, width or spacing", () => {
  expect(blockedTerm("A CHILD   PORN scene", terms)).toBe("child porn");
  expect(blockedTerm("ｃｓａｍ", terms)).toBe("csam");
  expect(blockedTerm("child​porn", terms)).toBe("child porn");
});

test("matches Latin terms as whole words only", () => {
  expect(blockedTerm("a csamplitude chart", terms)).toBeNull();
  expect(blockedTerm("csam.", terms)).toBe("csam");
});

test("matches Chinese terms inside a sentence", () => {
  expect(blockedTerm("生成一张儿童色情图片", terms)).toBe("儿童色情");
});

test("lets other prompts through", () => {
  expect(blockedTerm("A flower shop at dawn", terms)).toBeNull();
});

test("checkPrompt throws ContentBlockedError on a blocked prompt", () => {
  expect(() => checkPrompt("csam", terms)).toThrow(ContentBlockedError);
  expect(() => checkPrompt("A cat", terms)).not.toThrow();
});

test("the default list blocks its own terms", () => {
  expect(() => checkPrompt("child pornography")).toThrow(ContentBlockedError);
});
