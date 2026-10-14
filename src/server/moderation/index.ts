import { BLOCKED_TERMS } from "./blocklist";

// A prompt matched the blocklist, or the provider's own moderation refused it.
export class ContentBlockedError extends Error {}

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

// Folds the tricks that hide a term: full-width letters (NFKC), case,
// zero-width characters and extra spaces.
function normalize(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(ZERO_WIDTH, "").replace(/\s+/g, " ");
}

// Latin terms match whole words, so "csam" doesn't block "csamplitude".
// Chinese has no spaces between words, so CJK terms match anywhere. The
// words of a phrase may be joined by any spacing, or none.
function pattern(term: string): RegExp {
  const words = normalize(term).trim().split(" ").map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const start = /^[a-z0-9]/.test(words[0]) ? "(?<![a-z0-9])" : "";
  const end = /[a-z0-9]$/.test(words.at(-1) ?? "") ? "(?![a-z0-9])" : "";
  return new RegExp(`${start}${words.join("\\s*")}${end}`, "u");
}

// The first term the text contains, or null.
export function blockedTerm(text: string, terms: readonly string[] = BLOCKED_TERMS): string | null {
  const normalized = normalize(text);
  return terms.find((term) => pattern(term).test(normalized)) ?? null;
}

// Throws ContentBlockedError if the prompt contains a blocked term. Call it
// before spending credits.
export function checkPrompt(prompt: string, terms: readonly string[] = BLOCKED_TERMS): void {
  const term = blockedTerm(prompt, terms);
  if (term) throw new ContentBlockedError(`The prompt contains a blocked term: ${term}`);
}
