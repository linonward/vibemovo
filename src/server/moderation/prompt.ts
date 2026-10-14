import { ScanSemanticMode, WaffoPancake } from "@waffo/pancake-ts";
import { requireEnv } from "@/server/env";
import { checkPrompt, ContentBlockedError, ModerationUnavailableError } from "./index";

// https://docs.waffo.ai/api-reference/endpoints/content-safety/scan-prompt
// Only an explicit allow verdict may reach generation. Never log the prompt
// or the provider's response body, which may contain submitted text.
export async function screenPrompt(prompt: string): Promise<void> {
  checkPrompt(prompt);
  if (process.env.PROMPT_MODERATION !== "waffo") return;

  let retryAfter = 60;
  let action: unknown;
  try {
    const client = new WaffoPancake({
      merchantId: requireEnv("WAFFO_MERCHANT_ID"),
      privateKey: requireEnv("WAFFO_PRIVATE_KEY").replace(/\\n/g, "\n"),
      fetch: async (url, init) => {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
        if (response.status === 429) {
          const delay = Number(response.headers.get("Retry-After"));
          if (Number.isSafeInteger(delay) && delay > 0) retryAfter = delay;
        }
        if (!response.ok) throw new Error("Waffo screening request failed");
        return response;
      },
    });
    const verdict = await client.contentSafety.scanPrompt({ prompt, semantic: ScanSemanticMode.Enforce });
    action = verdict?.action;
  } catch {
    // The SDK's error can include submitted content. Keep it out of logs.
    throw new ModerationUnavailableError("Waffo prompt screening did not give a verdict", undefined, retryAfter);
  }

  if (action === "allow") return;
  if (action === "block") throw new ContentBlockedError("Waffo blocked the prompt");
  throw new ModerationUnavailableError(
    "Waffo prompt screening requires a later retry", undefined, action === "review" ? 3600 : 60,
  );
}
