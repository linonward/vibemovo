import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, expect, test, vi } from "vitest";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { subscription } from "@/server/payment/schema";
import { account, session } from "./schema";
import { auth } from "./index";

const storage = vi.hoisted(() => ({
  storageConfigured: vi.fn(() => true),
  deletePrefix: vi.fn<(prefix: string) => Promise<number>>(async () => 0),
}));
vi.mock("@/server/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/storage")>()),
  ...storage,
}));

afterEach(() => {
  vi.restoreAllMocks();
  storage.deletePrefix.mockReset();
  storage.storageConfigured.mockReturnValue(true);
});

async function createUser() {
  const ctx = await auth.$context;
  return ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Test User" },
    { method: "admin" },
  );
}

// The privacy policy promises deletion: stored images and videos (including
// uploaded start images) go with the account.
test("deleting a user deletes their stored images, videos and feedback attachments", async () => {
  const user = await createUser();

  await auth.options.user.deleteUser.afterDelete!(user);

  expect(storage.deletePrefix.mock.calls.map(([prefix]) => prefix).sort()).toEqual([
    `feedback/${user.id}/`,
    `images/${user.id}/`,
    `videos/${user.id}/`,
  ]);
});

test("a storage failure is logged; the account stays deleted", async () => {
  const user = await createUser();
  const error = vi.spyOn(log, "error").mockImplementation(() => {});
  storage.deletePrefix.mockRejectedValue(new Error("storage down"));

  await expect(auth.options.user.deleteUser.afterDelete!(user)).resolves.toBeUndefined();
  expect(error).toHaveBeenCalledWith("storage.user_files_not_deleted", { userId: user.id, error: expect.any(Error) });
});

test("skips storage when it isn't configured", async () => {
  const user = await createUser();
  storage.storageConfigured.mockReturnValue(false);

  await auth.options.user.deleteUser.afterDelete!(user);

  expect(storage.deletePrefix).not.toHaveBeenCalled();
});

test("deleting a user removes their sessions and accounts", async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Test User" },
    { method: "admin" },
  );
  await ctx.internalAdapter.createSession(user.id);
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: "google",
    accountId: randomUUID(),
  });

  await ctx.internalAdapter.deleteUser(user.id);

  const db = getDb();
  expect(await db.select().from(session).where(eq(session.userId, user.id))).toEqual([]);
  expect(await db.select().from(account).where(eq(account.userId, user.id))).toEqual([]);
});

test("refuses to delete a user whose subscription can still charge them", async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Subscriber" },
    { method: "admin" },
  );
  const beforeDelete = auth.options.user.deleteUser.beforeDelete!;
  await expect(beforeDelete(user)).resolves.toBeUndefined();

  await getDb().insert(subscription).values({
    userId: user.id,
    planId: "pro",
    credits: 1000,
    amount: 1000,
    currency: "usd",
    status: "active",
    provider: "stripe",
    providerSessionId: `cs_${randomUUID()}`,
  });

  await expect(beforeDelete(user)).rejects.toMatchObject({
    body: { code: "ACTIVE_SUBSCRIPTION" },
  });
});
