import { randomUUID } from "node:crypto";
import { beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { markRead, notify, pageNotifications, unreadCount } from "./index";

let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Reader" },
    { method: "admin" },
  );
  userId = user.id;
});

const imageDone = (imageId: string) => ({
  type: "image_succeeded" as const,
  data: { imageId, prompt: "A fox" },
});

test("stores a notification once per key, newest first", async () => {
  await notify(userId, `image:a-${userId}`, imageDone("a"));
  await notify(userId, `image:b-${userId}`, imageDone("b"));
  await notify(userId, `image:b-${userId}`, imageDone("b"));

  const { notifications, total } = await pageNotifications(userId);

  expect(total).toBe(2);
  expect(notifications).toMatchObject([
    { type: "image_succeeded", data: { imageId: "b", prompt: "A fox" }, readAt: null },
    { type: "image_succeeded", data: { imageId: "a" }, readAt: null },
  ]);
  expect(await unreadCount(userId)).toBe(2);
});

test("tells the caller whether it stored a new notification", async () => {
  const key = `image:a-${userId}`;

  expect(await notify(userId, key, imageDone("a"))).toBe(true);
  expect(await notify(userId, key, imageDone("a"))).toBe(false);
});

test("pages through the notifications", async () => {
  for (const n of [1, 2, 3]) await notify(userId, `image:${n}-${userId}`, imageDone(String(n)));

  const first = await pageNotifications(userId, 1, 2);
  const second = await pageNotifications(userId, 2, 2);

  expect(first.total).toBe(3);
  expect(first.notifications.map((n) => n.data)).toMatchObject([{ imageId: "3" }, { imageId: "2" }]);
  expect(second.notifications.map((n) => n.data)).toMatchObject([{ imageId: "1" }]);
});

test("marks one notification read, then all of them", async () => {
  await notify(userId, `image:a-${userId}`, imageDone("a"));
  await notify(userId, `image:b-${userId}`, imageDone("b"));
  const [newest] = (await pageNotifications(userId)).notifications;

  await markRead(userId, newest.id);
  expect(await unreadCount(userId)).toBe(1);
  expect((await pageNotifications(userId)).notifications[0].readAt).toBeInstanceOf(Date);

  await markRead(userId);
  expect(await unreadCount(userId)).toBe(0);
});

test("never touches another user's notifications", async () => {
  await notify(userId, `image:a-${userId}`, imageDone("a"));
  const [mine] = (await pageNotifications(userId)).notifications;
  const ctx = await auth.$context;
  const other = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Other" },
    { method: "admin" },
  );

  await markRead(other.id, mine.id);
  await markRead(other.id);

  expect(await unreadCount(userId)).toBe(1);
  expect((await pageNotifications(other.id)).total).toBe(0);
});

test("a failure to notify is logged, not thrown", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  // No such user: the foreign key rejects the row.
  await expect(notify("missing-user", `image:x-${randomUUID()}`, imageDone("x"))).resolves.toBe(false);

  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
