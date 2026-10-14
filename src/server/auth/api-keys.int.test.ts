import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test } from "vitest";
import { getDb } from "@/server/db";
import { API_KEY_HEADER, API_KEY_RATE_LIMIT, listApiKeys, MAX_API_KEYS } from "./api-keys";
import { auth } from "./index";
import { apikey } from "./schema";
import { getSession } from "./session";

const cleanup: string[] = [];

afterEach(async () => {
  const ctx = await auth.$context;
  for (const id of cleanup.splice(0)) await ctx.internalAdapter.deleteUser(id);
});

async function createUser() {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `keys-${randomUUID()}@example.com`, name: "Scripter" },
    { method: "admin" },
  );
  cleanup.push(user.id);
  return user.id;
}

const createKey = (userId: string, body: { name?: string; expiresIn?: number | null } = {}) =>
  auth.api.createApiKey({ body: { name: "script", userId, ...body } });

const withKey = (key: string) => new Headers({ [API_KEY_HEADER]: key });

test("a key in the header gets its owner's session", async () => {
  const userId = await createUser();
  const { key } = await createKey(userId);

  expect(key).toMatch(/^sk_/);
  const session = await getSession(withKey(key));
  expect(session?.user.id).toBe(userId);
});

test("stores only a hash and the key's first characters", async () => {
  const userId = await createUser();
  const { key, id } = await createKey(userId);

  const [row] = await getDb().select().from(apikey).where(eq(apikey.id, id));
  expect(row.key).not.toBe(key);
  expect(key.startsWith(row.start ?? "?")).toBe(true);
});

// The plugin throws instead of returning no session; withSession maps it.
test("an unknown, deleted, expired or disabled key is refused", async () => {
  const userId = await createUser();
  await expect(getSession(withKey("sk_not-a-real-key"))).rejects.toMatchObject({ body: { code: "INVALID_API_KEY" } });

  const deleted = await createKey(userId);
  await getDb().delete(apikey).where(eq(apikey.id, deleted.id));
  await expect(getSession(withKey(deleted.key))).rejects.toMatchObject({ body: { code: "INVALID_API_KEY" } });

  const expired = await createKey(userId, { expiresIn: 24 * 3600 });
  await getDb().update(apikey).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apikey.id, expired.id));
  await expect(getSession(withKey(expired.key))).rejects.toMatchObject({ body: { code: "KEY_EXPIRED" } });

  const disabled = await createKey(userId);
  await getDb().update(apikey).set({ enabled: false }).where(eq(apikey.id, disabled.id));
  await expect(getSession(withKey(disabled.key))).rejects.toMatchObject({ body: { code: "KEY_DISABLED" } });
});

test("needs a name", async () => {
  const userId = await createUser();
  await expect(auth.api.createApiKey({ body: { userId } })).rejects.toThrow();
});

test(`refuses a key past ${MAX_API_KEYS}`, async () => {
  const userId = await createUser();
  for (let n = 0; n < MAX_API_KEYS; n++) await createKey(userId, { name: `k${n}` });

  await expect(createKey(userId, { name: "one too many" })).rejects.toMatchObject({ body: { code: "TOO_MANY_KEYS" } });
  expect(await getDb().$count(apikey, eq(apikey.referenceId, userId))).toBe(MAX_API_KEYS);
});

test("limits each key per window", async () => {
  const userId = await createUser();
  const { key } = await createKey(userId);

  for (let n = 0; n < API_KEY_RATE_LIMIT.maxRequests; n++) expect(await getSession(withKey(key))).not.toBeNull();
  await expect(getSession(withKey(key))).rejects.toMatchObject({ status: "TOO_MANY_REQUESTS" });
});

test("deleting the user deletes their keys", async () => {
  const userId = await createUser();
  const { key } = await createKey(userId);

  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUser(userId);
  cleanup.splice(cleanup.indexOf(userId), 1);
  await auth.options.user.deleteUser.afterDelete!({ id: userId } as never);

  expect(await getDb().$count(apikey, eq(apikey.referenceId, userId))).toBe(0);
  await expect(getSession(withKey(key))).rejects.toMatchObject({ body: { code: "INVALID_API_KEY" } });
});

test("lists the user's keys, newest first, without the secret", async () => {
  const userId = await createUser();
  const other = await createUser();
  const first = await createKey(userId, { name: "first" });
  const second = await createKey(userId, { name: "second", expiresIn: 30 * 24 * 3600 });
  await createKey(other, { name: "theirs" });
  await getDb().update(apikey).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(apikey.id, first.id));

  const keys = await listApiKeys(userId);

  expect(keys.map((k) => k.name)).toEqual(["second", "first"]);
  expect(Object.keys(keys[0]).sort()).toEqual(["createdAt", "expiresAt", "id", "lastUsedAt", "name", "start"]);
  expect(second.key.startsWith(keys[0].start)).toBe(true);
  expect(keys[0].expiresAt).toBeInstanceOf(Date);
  expect(keys[1].expiresAt).toBeNull();
});
