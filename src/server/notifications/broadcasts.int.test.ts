import { randomUUID } from "node:crypto";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getDb } from "@/server/db";
import { InvalidBroadcastError, listBroadcasts, sendBroadcast, UnknownRecipientError } from "./broadcasts";
import { pageNotifications } from "./index";

let email: string;
let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  email = `user-${randomUUID()}@example.com`;
  userId = (await ctx.internalAdapter.createUser({ email, name: "Reader" }, { method: "admin" })).id;
});

const send = (input: Partial<Parameters<typeof sendBroadcast>[0]> = {}) =>
  sendBroadcast({
    title: "Maintenance",
    body: "We restart at 02:00 UTC.",
    requestId: randomUUID(),
    sentBy: "admin@example.com",
    ...input,
  });

test("sends to one user by email, ignoring case, once per request", async () => {
  const requestId = randomUUID();

  const first = await send({ title: "  Hello  ", email: email.toUpperCase(), requestId });
  const again = await send({ title: "Hello", email, requestId });

  expect(first).toMatchObject({ title: "Hello", email, recipients: 1, sentBy: "admin@example.com" });
  expect(again.id).toBe(first.id);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "broadcast", data: { broadcastId: first.id, title: "Hello", body: "We restart at 02:00 UTC." } },
  ]);
});

// Really sending to every user would reach the users other test files
// create at the same time and break their exact notification lists. So
// this test only reads the fan-out: the same statement as for one user,
// without the filter.
test("sends to every user", async () => {
  const execute = vi.spyOn(getDb(), "execute").mockResolvedValueOnce({ rows: [] } as never);

  const sent = await send();

  expect(sent.email).toBeNull();
  const { sql } = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as SQL);
  expect(sql).toMatch(/insert into "notification"[\s\S]*from "user"\s+on conflict \(key\) do nothing/);
  expect(sql).not.toMatch(/where/i);
  execute.mockRestore();
});

test("rejects empty or long text, a bad request ID and unknown emails", async () => {
  await expect(send({ title: " " })).rejects.toThrow(InvalidBroadcastError);
  await expect(send({ title: "x".repeat(101) })).rejects.toThrow(InvalidBroadcastError);
  await expect(send({ body: "" })).rejects.toThrow(InvalidBroadcastError);
  await expect(send({ body: "x".repeat(1001) })).rejects.toThrow(InvalidBroadcastError);
  await expect(send({ requestId: "" })).rejects.toThrow(InvalidBroadcastError);
  await expect(send({ email: "nobody@example.com" })).rejects.toThrow(UnknownRecipientError);

  expect((await pageNotifications(userId)).total).toBe(0);
});

test("lists the newest broadcasts first", async () => {
  const older = await send({ email, title: "Older" });
  const newer = await send({ email, title: "Newer" });

  const ids = (await listBroadcasts(100)).map((b) => b.id);

  expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  expect(ids.indexOf(older.id)).toBeGreaterThanOrEqual(0);
});
