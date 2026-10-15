// Credits charged for each message the user sends.
export const CHAT_CREDIT_COST = 1;

// DeepSeek V4.1 Flash on Bailian. Check the model list for the key's region.
export const DEFAULT_CHAT_MODEL = "deepseek-v4.1-flash";

// Bounds what one message can cost. The model sees the newest messages
// that fit in MAX_CONTEXT_CHARS; older ones stay saved but aren't sent.
export const MAX_MESSAGE_CHARS = 4_000;
export const MAX_CONTEXT_CHARS = 20_000;
// Characters of the first message a chat's title keeps.
export const TITLE_CHARS = 60;

// Yuan to US dollars, for model prices Bailian lists in yuan. Cost metrics
// are in dollars, like the packs. Update it when the rate moves.
export const CNY_TO_USD = 0.14;

// Bailian's list prices for chat models in the Beijing region, in yuan per
// million tokens, at Beijing peak hours (8:00 to 22:00) and off-peak. Check
// the Bailian price page and update them when they change; calls to a model
// not listed here record no cost.
export const CHAT_MODEL_PRICES: Record<string, Record<"input" | "output", { peak: number; offPeak: number }>> = {
  "deepseek-v4.1-flash": { input: { peak: 2, offPeak: 1 }, output: { peak: 8, offPeak: 4 } },
};
