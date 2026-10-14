import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { InvalidFeedbackError, listFeedback, submitFeedback } from "./index";
import { feedback } from "./schema";

const storage = vi.hoisted(() => ({
  putObject: vi.fn(async () => {}), deleteObject: vi.fn(async () => {}),
  deletePrefix: vi.fn(async () => 0), signedUrl: vi.fn(async (key: string) => `https://storage.test/${key}`),
  storageConfigured: vi.fn(() => true),
}));
vi.mock("@/server/storage", () => storage);
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
let userId: string;
beforeEach(async () => {
  vi.clearAllMocks();
  const ctx = await auth.$context;
  userId = (await ctx.internalAdapter.createUser({ email: `feedback-${randomUUID()}@example.com`, name: "Reader" }, { method: "admin" })).id;
});
afterEach(async () => { await getDb().delete(user).where(eq(user.id, userId)); });

test("stores trimmed feedback once even for concurrent retries", async () => {
  const input = { message: "  Please add export.  ", requestId: randomUUID() };
  const [first, again] = await Promise.all([submitFeedback(userId, input), submitFeedback(userId, input)]);
  expect(first.id).toBe(again.id);
  expect(first).toMatchObject({ userId, message: "Please add export." });
  expect(await getDb().$count(feedback, eq(feedback.userId, userId))).toBe(1);
  const result = await listFeedback({ pageSize: 100 });
  expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: first.id, name: "Reader", message: "Please add export." })]));
});

test.each([null, {}, { message: " " }, { message: "x".repeat(2001) }, { message: 12 }, { message: "Hello", requestId: "bad" }])("rejects invalid input %j", async (input) => {
  await expect(submitFeedback(userId, input)).rejects.toThrow(InvalidFeedbackError);
  expect(await getDb().$count(feedback, eq(feedback.userId, userId))).toBe(0);
});

test("paginates newest first and deletes feedback with the account", async () => {
  const older = await submitFeedback(userId, { message: "First", requestId: randomUUID() });
  const newer = await submitFeedback(userId, { message: "Second", requestId: randomUUID() });
  expect((await listFeedback({ pageSize: 1 })).items[0].id).toBe(newer.id);
  expect((await listFeedback({ page: 2, pageSize: 1 })).items[0].id).toBe(older.id);
  await getDb().delete(user).where(eq(user.id, userId));
  expect(await getDb().$count(feedback, eq(feedback.userId, userId))).toBe(0);
});


test("stores image-only feedback once and keeps attachments out of the list payload", async () => {
  const input = { message: "", requestId: randomUUID() };
  const [first, again] = await Promise.all([
    submitFeedback(userId, input, [png]), submitFeedback(userId, input, [png]),
  ]);
  expect(first.id).toBe(again.id);
  expect(first.images).toHaveLength(1);
  expect(storage.putObject).toHaveBeenCalledTimes(1);
  expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/^feedback\//), png, "image/png");
  const item = (await listFeedback({ pageSize: 100 })).items.find((item) => item.id === first.id);
  expect(item).toMatchObject({ imageCount: 1 });
  expect(item).not.toHaveProperty("images");
});

test("rejects invalid image types, counts and total size before uploading", async () => {
  const input = { message: "Screenshot", requestId: randomUUID() };
  for (const images of [[new TextEncoder().encode("<svg/>")], [png, png, png, png], [new Uint8Array(4 * 1024 * 1024 + 1)]]) {
    await expect(submitFeedback(userId, input, images)).rejects.toThrow(InvalidFeedbackError);
  }
  expect(storage.putObject).not.toHaveBeenCalled();
});

test("cleans up an interrupted upload and allows retry", async () => {
  storage.putObject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Storage down"));
  const input = { message: "Two screenshots", requestId: randomUUID() };
  await expect(submitFeedback(userId, input, [png, png])).rejects.toThrow("Storage down");
  expect(await getDb().$count(feedback, eq(feedback.userId, userId))).toBe(0);
  expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  expect((await submitFeedback(userId, input, [png, png])).images).toHaveLength(2);
});

test("text submissions still work without storage while image submissions fail", async () => {
  storage.storageConfigured.mockReturnValueOnce(false);
  await expect(submitFeedback(userId, { message: "", requestId: randomUUID() }, [png]))
    .rejects.toBeInstanceOf((await import("./index")).FeedbackStorageDisabledError);
  expect(storage.putObject).not.toHaveBeenCalled();
  expect((await submitFeedback(userId, { message: "Text", requestId: randomUUID() })).message).toBe("Text");
});
