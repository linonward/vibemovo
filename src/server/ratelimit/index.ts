import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { rateLimit } from "@/server/auth/schema";
import { getDb } from "@/server/db";

export type Limit = { max: number; windowMs: number };

// Counts one hit on `key` in a fixed window and says whether it's allowed.
// Shares Better Auth's rate_limit table; prefix keys (such as "api:") so they
// never meet Better Auth's own. Here last_request holds the window's start.
// One upsert per hit, so hits that arrive together all count.
export async function hitLimit(
  key: string,
  { max, windowMs }: Limit,
  now = Date.now(),
): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }> {
  const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`;
  const [row] = await getDb()
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count, start: rateLimit.lastRequest });
  if (row.count <= max) return { allowed: true };
  return { allowed: false, retryAfterMs: row.start + windowMs - now };
}
