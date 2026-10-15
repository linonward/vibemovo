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
