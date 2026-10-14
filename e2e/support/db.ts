import { existsSync } from "node:fs";
import { Client } from "pg";

// Same source as drizzle.config.ts: the environment, else .env.
if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile();

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows;
  } finally {
    await client.end();
  }
}

// Rate-limit counters Better Auth stored for an IP.
export async function rateLimitKeys(ip: string): Promise<string[]> {
  const rows = await query<{ key: string }>(`select key from rate_limit where key like $1`, [`%${ip}%`]);
  return rows.map((row) => row.key);
}

// Makes sure at least `count` users exist, so a test doesn't depend on what
// earlier runs left in the database. Rerunning adds nothing.
export async function ensureUsers(count: number) {
  await query(
    `insert into "user" (id, name, email)
     select 'e2e-filler-' || n, 'E2E filler ' || n, 'e2e-filler-' || n || '@example.com'
     from generate_series(1, $1) as n
     on conflict do nothing`,
    [count],
  );
}

// Failed images for a user, newest first in the given order. They render as
// placeholders, so the page needs no storage.
export async function addFailedImages(userId: string, aspects: string[]) {
  await query(
    `insert into image (id, user_id, prompt, aspect, status, created_at)
     select gen_random_uuid()::text, $1, 'Seeded ' || a.aspect, a.aspect, 'failed', now() - a.n * interval '1 minute'
     from unnest($2::text[]) with ordinality as a(aspect, n)`,
    [userId, aspects],
  );
}

// Failed videos for a user, newest first. They render as placeholders, so
// the page needs no storage.
export async function addFailedVideos(userId: string, count: number) {
  await query(
    `insert into video (id, user_id, prompt, duration, provider, resolution, credits, status, created_at)
     select gen_random_uuid()::text, $1, 'Seeded video ' || n, 5, 'seeapi', '480p', 20, 'failed', now() - n * interval '1 minute'
     from generate_series(1, $2) as n`,
    [userId, count],
  );
}

// Credit-pack orders for the user with this email, newest first, in the given
// statuses. Returns their IDs in the same order.
export async function addOrders(email: string, statuses: string[]) {
  const rows = await query<{ id: string }>(
    `insert into "order" (id, user_id, pack_id, credits, amount, currency, status, provider, provider_session_id, created_at)
     select gen_random_uuid()::text, u.id, 'small', 100, 500, 'usd', s.status, 'stripe', 'cs_e2e_' || gen_random_uuid(), now() - s.n * interval '1 minute'
     from "user" u, unnest($2::text[]) with ordinality as s(status, n)
     where u.email = $1
     returning id, created_at`,
    [email, statuses],
  );
  return rows.map((row) => row.id);
}

// Failed images for a user, each with its unread "image failed"
// notification, newest first: "Notified 1", "Notified 2", ...
export async function addFailedImageNotifications(userId: string, count: number) {
  await query(
    `with images as (
       insert into image (id, user_id, prompt, aspect, status, created_at)
       select gen_random_uuid()::text, $1, 'Notified ' || n, '1:1', 'failed', now() - n * interval '1 minute'
       from generate_series(1, $2) as n
       returning id, prompt, created_at
     )
     insert into notification (id, user_id, type, data, key, created_at)
     select gen_random_uuid()::text, $1, 'image_failed',
       jsonb_build_object('imageId', id, 'prompt', prompt, 'credits', 2), 'image:' || id, created_at
     from images`,
    [userId, count],
  );
}

// An active Stripe subscription for the user with this email, as if the
// first charge had gone through. Returns its ID, which Stripe events carry
// in their metadata.
export async function addSubscription(email: string) {
  const [row] = await query<{ id: string }>(
    `insert into subscription (id, user_id, plan_id, credits, amount, currency, status, provider, provider_session_id)
     select gen_random_uuid()::text, u.id, 'pro', 300, 1000, 'usd', 'active', 'stripe', 'cs_e2e_' || gen_random_uuid()
     from "user" u
     where u.email = $1
     returning id`,
    [email],
  );
  return row.id;
}
