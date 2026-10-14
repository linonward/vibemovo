import { apiKey } from "@better-auth/api-key";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { API_KEY_HEADER, API_KEY_RATE_LIMIT, MAX_API_KEYS } from "./api-key-config";
import { apikey } from "./schema";

export { API_KEY_HEADER, API_KEY_RATE_LIMIT, MAX_API_KEYS };

// Users' API keys, for calling the routes that allow them
// (withSession({ apiKey: true })). A request with the key in API_KEY_HEADER
// gets its owner's session from getSession. Keys are stored hashed and shown
// once. No expiry by default: the page offers 30, 90 or 365 days, or never.
export const apiKeys = () =>
  apiKey({
    defaultPrefix: "sk_",
    requireName: true,
    apiKeyHeaders: API_KEY_HEADER,
    enableSessionForAPIKeys: true,
    rateLimit: { enabled: true, ...API_KEY_RATE_LIMIT },
    keyExpiration: { maxExpiresIn: 365 },
  });

export class TooManyKeysError extends APIError {
  constructor() {
    super("BAD_REQUEST", { code: "TOO_MANY_KEYS", message: `A user can have at most ${MAX_API_KEYS} API keys` });
  }
}

// Refuses an 11th key. The plugin has no such limit, so this runs before
// its create endpoint, for the signed-in user.
export const limitApiKeys = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/api-key/create") return;
  const userId = ctx.context.session?.user.id ?? (ctx.body as { userId?: string } | undefined)?.userId;
  if (!userId) return;
  const count = await getDb().$count(apikey, eq(apikey.referenceId, userId));
  if (count >= MAX_API_KEYS) throw new TooManyKeysError();
});

// The user's keys for the API keys page, newest first. Never the key
// itself: only its first characters, which the page shows to tell keys apart.
export async function listApiKeys(userId: string) {
  const rows = await getDb()
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      createdAt: apikey.createdAt,
      lastUsedAt: apikey.lastRequest,
      expiresAt: apikey.expiresAt,
    })
    .from(apikey)
    .where(eq(apikey.referenceId, userId))
    .orderBy(desc(apikey.createdAt), desc(apikey.id));
  return rows.map((row) => ({ ...row, name: row.name ?? "", start: row.start ?? "" }));
}
