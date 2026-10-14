// The header a script sends its key in.
export const API_KEY_HEADER = "x-api-key";
// Keys a user may have at once, revoked ones excluded (revoking deletes).
export const MAX_API_KEYS = 10;
// Requests one key may make per window. Each user's own limits
// (src/app/api/_lib/limits.ts) still apply on top.
export const API_KEY_RATE_LIMIT = { maxRequests: 60, timeWindow: 60_000 };
