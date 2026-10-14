// Credits charged for each message the user sends.
export const CHAT_CREDIT_COST = 1;

// DeepSeek's alias for its current V4 Flash model.
export const DEFAULT_CHAT_MODEL = "deepseek-flash";

// Bounds what one message can cost. The model sees the newest messages
// that fit in MAX_CONTEXT_CHARS; older ones stay saved but aren't sent.
export const MAX_MESSAGE_CHARS = 4_000;
export const MAX_CONTEXT_CHARS = 20_000;
// Characters of the first message a chat's title keeps.
export const TITLE_CHARS = 60;
