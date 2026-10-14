import { generateKeyPairSync, randomUUID } from "node:crypto";
import { asc, eq, like } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { auth } from "@/server/auth";
import { getBalance, grantCredits, InsufficientCreditsError, spendCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { creditTransaction } from "@/server/credits/schema";
import { pageNotifications } from "@/server/notifications";
import { notification } from "@/server/notifications/schema";
import { IMAGE_STALE_AFTER_MS, imageCost } from "./config";
import { image } from "./schema";

// Fake Bailian and storage. Their own tests cover the HTTP calls.
const { ai, storage } = vi.hoisted(() => {
  class ImageGenerationError extends Error {
    constructor(
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  return {
    ai: {
      ImageGenerationError,
      dashscopeConfigured: vi.fn(() => true),
      submitImage: vi.fn<(input: { prompt: string; size: string }) => Promise<string>>(async () => "task-1"),
      imageResult: vi.fn<
        (taskId: string) => Promise<
          | { status: "pending" }
          | { status: "succeeded"; url: string }
          | { status: "failed"; code?: string; error: string }
        >
      >(async () => ({ status: "succeeded", url: "https://bailian.test/out.png" })),
    },
    storage: {
      storageConfigured: vi.fn(() => true),
      putObject: vi.fn<(key: string, body: Uint8Array, type: string) => Promise<void>>(async () => {}),
      signedUrl: vi.fn(
        async (key: string, options?: { download?: string }) =>
          `https://storage.test/${key}?signed${options?.download ? `&download=${options.download}` : ""}`,
      ),
    },
  };
});
vi.mock("@/server/ai/dashscope", () => ai);
// The real ledger, with a way to make a refund fail once.
vi.mock("@/server/credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/credits")>();
  return { ...actual, grantCredits: vi.fn(actual.grantCredits) };
});
vi.mock("@/server/storage", () => storage);

const {
  createImage,
  refreshImage,
  countImages,
  listImages,
  pageImages,
  getImage,
  imageDownloadUrl,
  sweepStaleImages,
  ImagesDisabledError,
  InvalidImageRequestError,
  ContentBlockedError,
} = await import("./index");

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Artist" },
    { method: "admin" },
  );
  userId = user.id;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { headers: { "content-type": "image/png" } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  ai.dashscopeConfigured.mockReturnValue(true);
  ai.imageResult.mockImplementation(async () => ({ status: "succeeded", url: "https://bailian.test/out.png" }));
  storage.storageConfigured.mockReturnValue(true);
});

const rows = () => getDb().select().from(image).where(eq(image.userId, userId));

test("spends the cost and queues the image with Bailian", async () => {
  const before = await getBalance(userId);

  const result = await createImage({ userId, prompt: "  A flower shop  ", aspect: "16:9" });

  expect(ai.submitImage).toHaveBeenCalledWith({ prompt: "A flower shop", size: "1696*960" });
  expect(result).toMatchObject({ prompt: "A flower shop", aspect: "16:9", status: "pending", url: null });
  expect(await getBalance(userId)).toBe(before - imageCost);
  expect(await rows()).toMatchObject([{ status: "pending", taskId: "task-1", storageKey: null }]);
});

test("refunds the cost and records the failure when Bailian refuses the task", async () => {
  const before = await getBalance(userId);
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("Bailian 500"));

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow("Bailian 500");

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "Bailian 500", taskId: null }]);
});

test("a prompt on the blocklist spends nothing and never reaches Bailian", async () => {
  const before = await getBalance(userId);

  await expect(createImage({ userId, prompt: "A CSAM scene", aspect: "1:1" })).rejects.toThrow(ContentBlockedError);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toEqual([]);
  expect(ai.submitImage).not.toHaveBeenCalled();
});

test("reports a blocked prompt as its own error", async () => {
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("Bailian 400", "DataInspectionFailed"));

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow(ContentBlockedError);
});

test("a refresh leaves a running image pending", async () => {
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });
  ai.imageResult.mockResolvedValueOnce({ status: "pending" });

  expect(await refreshImage(userId, id)).toMatchObject({ id, status: "pending", url: null });
  expect(ai.imageResult).toHaveBeenCalledWith("task-1");
  expect(storage.putObject).not.toHaveBeenCalled();
});

test("a refresh stores a finished image, then answers from the database", async () => {
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });

  const result = await refreshImage(userId, id);

  const key = `images/${userId}/${id}.png`;
  expect(storage.putObject).toHaveBeenCalledWith(key, png, "image/png");
  expect(result).toMatchObject({ status: "succeeded", url: `https://storage.test/${key}?signed` });
  expect(await rows()).toMatchObject([{ status: "succeeded", storageKey: key }]);

  await refreshImage(userId, id);
  expect(ai.imageResult).toHaveBeenCalledTimes(1);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "image_succeeded", data: { imageId: id, prompt: "x" } },
  ]);
});

test("a refresh fails and refunds an image Bailian failed, once", async () => {
  const before = await getBalance(userId);
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });
  ai.imageResult.mockResolvedValueOnce({ status: "failed", code: "DataInspectionFailed", error: "blocked" });

  expect(await refreshImage(userId, id)).toMatchObject({ status: "failed", url: null });
  await refreshImage(userId, id);

  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "image_failed", data: { imageId: id, prompt: "x", credits: imageCost } },
  ]);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "blocked" }]);
});

test("logs each image's submission and outcome, once", async () => {
  const info = vi.spyOn(log, "info");
  const warn = vi.spyOn(log, "warn");
  const done = await createImage({ userId, prompt: "x", aspect: "1:1" });
  await refreshImage(userId, done.id);
  await refreshImage(userId, done.id);
  const bad = await createImage({ userId, prompt: "y", aspect: "1:1" });
  ai.imageResult.mockResolvedValueOnce({ status: "failed", error: "blocked" });
  await refreshImage(userId, bad.id);
  await refreshImage(userId, bad.id);

  const events = (spy: typeof info) =>
    spy.mock.calls.filter(([event]) => event.startsWith("image.")).map(([event, fields]) => ({ event, ...fields }));
  expect(events(info)).toEqual([
    { event: "image.submitted", id: done.id, userId, credits: imageCost },
    { event: "image.succeeded", id: done.id, userId, ms: expect.any(Number) },
    { event: "image.submitted", id: bad.id, userId, credits: imageCost },
  ]);
  expect(events(warn)).toEqual([{ event: "image.failed", id: bad.id, userId, credits: imageCost, error: "blocked" }]);
});

test("a failure refunds nothing once another call has settled the image", async () => {
  const before = await getBalance(userId);
  // Another call collects the image while the submission is failing.
  ai.submitImage.mockImplementationOnce(async () => {
    await getDb().update(image).set({ status: "succeeded" }).where(eq(image.userId, userId));
    throw new ai.ImageGenerationError("Bailian 500");
  });

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow("Bailian 500");

  expect(await getBalance(userId)).toBe(before - imageCost);
  expect(await rows()).toMatchObject([{ status: "succeeded" }]);
});

test("a refund that fails leaves the image pending, so the sweep refunds it later", async () => {
  const before = await getBalance(userId);
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("Bailian 500"));
  vi.mocked(grantCredits).mockRejectedValueOnce(new Error("Connection lost"));

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow("Connection lost");

  expect(await rows()).toMatchObject([{ status: "pending", error: null }]);
  expect(await getBalance(userId)).toBe(before - imageCost);

  await getDb()
    .update(image)
    .set({ createdAt: new Date(Date.now() - 20 * 60_000) })
    .where(eq(image.userId, userId));
  await sweepStaleImages();

  expect(await rows()).toMatchObject([{ status: "failed" }]);
  expect(await getBalance(userId)).toBe(before);
});

test("keeps the credit and notification keys that images in flight rely on", async () => {
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });
  ai.imageResult.mockResolvedValueOnce({ status: "failed", error: "blocked" });
  await refreshImage(userId, id);

  expect(await ledger(id)).toEqual({
    credits: [
      { key: `image:${id}`, reason: "image", amount: -imageCost },
      { key: `image-refund:${id}`, reason: "image refund", amount: imageCost },
    ],
    notes: [{ key: `image:${id}`, type: "image_failed" }],
  });
});

test("a refresh that can't store the image leaves it pending for a retry", async () => {
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });
  storage.putObject.mockRejectedValueOnce(new Error("bucket gone"));

  await expect(refreshImage(userId, id)).rejects.toThrow("bucket gone");

  expect(await rows()).toMatchObject([{ status: "pending" }]);
});

test("a refresh finds only the user's own image", async () => {
  const { id } = await createImage({ userId, prompt: "x", aspect: "1:1" });

  expect(await refreshImage(randomUUID(), id)).toBeNull();
  expect(await refreshImage(userId, randomUUID())).toBeNull();
});

test("without enough credits, calls nothing and records nothing", async () => {
  const balance = await getBalance(userId);
  if (balance > 0) {
    await spendCredits({ userId, amount: balance, reason: "test", idempotencyKey: randomUUID() });
  }

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow(
    InsufficientCreditsError,
  );

  expect(ai.submitImage).not.toHaveBeenCalled();
  expect(await rows()).toEqual([]);
});

test.each([
  { prompt: "   ", aspect: "1:1" },
  { prompt: "x".repeat(2001), aspect: "1:1" },
  { prompt: "x", aspect: "2:1" },
])("rejects $aspect with a prompt of length $prompt.length", async ({ prompt, aspect }) => {
  await expect(createImage({ userId, prompt, aspect })).rejects.toThrow(InvalidImageRequestError);
  expect(ai.submitImage).not.toHaveBeenCalled();
});

test("is off until Bailian and storage are both configured", async () => {
  storage.storageConfigured.mockReturnValue(false);

  await expect(createImage({ userId, prompt: "x", aspect: "1:1" })).rejects.toThrow(
    ImagesDisabledError,
  );
});

// Creates an image and lets Bailian finish it.
async function finishedImage(prompt: string) {
  const { id } = await createImage({ userId, prompt, aspect: "1:1" });
  return (await refreshImage(userId, id))!;
}

test("counts only the user's finished images", async () => {
  await finishedImage("first");
  await createImage({ userId, prompt: "pending", aspect: "1:1" });
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("nope"));
  await createImage({ userId, prompt: "failed", aspect: "1:1" }).catch(() => {});
  await finishedImage("fourth");

  expect(await countImages(userId)).toBe(2);
  expect(await countImages(randomUUID())).toBe(0);
});

test("lists only the user's images, newest first, signing only stored ones", async () => {
  const first = await finishedImage("first");
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("nope"));
  await createImage({ userId, prompt: "failed", aspect: "1:1" }).catch(() => {});
  const third = await finishedImage("third");

  const list = await listImages(userId);

  expect(list.map((i) => i.prompt)).toEqual(["third", "failed", "first"]);
  expect(list[0]).toMatchObject({ id: third.id, url: expect.stringContaining(third.id) });
  expect(list[1]).toMatchObject({ status: "failed", url: null });
  expect(list[2].id).toBe(first.id);
  expect(list[1]).not.toHaveProperty("error");
  expect(await listImages(randomUUID())).toEqual([]);
});

test("pages through the user's images, newest first, counting them all", async () => {
  const first = await finishedImage("first");
  ai.submitImage.mockRejectedValueOnce(new ai.ImageGenerationError("nope"));
  await createImage({ userId, prompt: "failed", aspect: "1:1" }).catch(() => {});
  await finishedImage("third");

  const one = await pageImages(userId, 1, 2);
  const two = await pageImages(userId, 2, 2);

  expect(one.total).toBe(3);
  expect(one.images.map((i) => i.prompt)).toEqual(["third", "failed"]);
  expect(two).toMatchObject({ total: 3, images: [{ id: first.id, url: expect.stringContaining(first.id) }] });
  expect(await pageImages(userId, 3, 2)).toEqual({ images: [], total: 3 });
  expect(await pageImages(randomUUID())).toEqual({ images: [], total: 0 });
});

test("gets one of the user's images without asking Bailian", async () => {
  const done = await finishedImage("done");
  const pending = await createImage({ userId, prompt: "pending", aspect: "16:9" });
  ai.imageResult.mockClear();

  expect(await getImage(userId, done.id)).toMatchObject({ id: done.id, url: expect.stringContaining(done.id) });
  expect(await getImage(userId, pending.id)).toMatchObject({ status: "pending", aspect: "16:9", url: null });
  expect(ai.imageResult).not.toHaveBeenCalled();
  expect(await getImage(randomUUID(), done.id)).toBeNull();
  expect(await getImage(userId, "not-an-id")).toBeNull();
});

test("signs a download only for the user's stored images", async () => {
  const done = await finishedImage("done");
  const pending = await createImage({ userId, prompt: "pending", aspect: "1:1" });

  expect(await imageDownloadUrl(userId, done.id)).toBe(
    `https://storage.test/images/${userId}/${done.id}.png?signed&download=image-${done.id}.png`,
  );
  expect(await imageDownloadUrl(userId, pending.id)).toBeNull();
  expect(await imageDownloadUrl(randomUUID(), done.id)).toBeNull();
});

// An image whose request crashed after the spend, before or after submitting.
async function abandonedImage(minutesAgo: number, taskId: string | null = null) {
  const id = randomUUID();
  await spendCredits({ userId, amount: imageCost, reason: "image", idempotencyKey: `image:${id}` });
  await getDb()
    .insert(image)
    .values({ id, userId, prompt: "Lost", aspect: "1:1", taskId, createdAt: new Date(Date.now() - minutesAgo * 60_000) });
  return id;
}

const statuses = async () => Object.fromEntries((await rows()).map((row) => [row.id, row.status]));

test("the sweep fails and refunds images never submitted, once", async () => {
  const before = await getBalance(userId);
  const stale = await abandonedImage(20);
  const fresh = await abandonedImage(1);

  await sweepStaleImages();
  await sweepStaleImages();

  expect(await statuses()).toEqual({ [stale]: "failed", [fresh]: "pending" });
  // The fresh one may still be submitted, so only the stale one is refunded.
  expect(await getBalance(userId)).toBe(before - imageCost);
});

// A pending image another test or E2E left in the shared database.
async function someoneElsesImage(minutesAgo: number) {
  const ctx = await auth.$context;
  const other = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Other" },
    { method: "admin" },
  );
  await getDb()
    .insert(image)
    .values({
      userId: other.id,
      prompt: "Left over",
      aspect: "1:1",
      taskId: `task-${randomUUID()}`,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    });
}

test("the sweep collects submitted images nobody polled for", async () => {
  await someoneElsesImage(16);
  // A second past the stale age, so these are the newest stale images: the
  // sweep takes only the newest IMAGE_SWEEP_BATCH, and the shared database
  // can hold other pending images.
  const stale = IMAGE_STALE_AFTER_MS / 60_000 + 1 / 60;
  const done = await abandonedImage(stale, "task-done");
  const running = await abandonedImage(stale, "task-running");
  const recent = await abandonedImage(0, "task-recent");
  ai.imageResult.mockImplementation(async (taskId) =>
    taskId === "task-running" ? { status: "pending" } : { status: "succeeded", url: "https://bailian.test/out.png" },
  );

  // Counts include other pending images in the shared database.
  expect((await sweepStaleImages()).checked).toBeGreaterThanOrEqual(2);

  expect(ai.imageResult).toHaveBeenCalledWith("task-done");
  expect(ai.imageResult).toHaveBeenCalledWith("task-running");
  expect(ai.imageResult).not.toHaveBeenCalledWith("task-recent");
  expect(await statuses()).toEqual({ [done]: "succeeded", [running]: "pending", [recent]: "pending" });
});

test("the sweep records when it last asked about each image", async () => {
  const stale = IMAGE_STALE_AFTER_MS / 60_000 + 1 / 60;
  const id = await abandonedImage(stale, "task-running");
  ai.imageResult.mockResolvedValue({ status: "pending" });

  const before = new Date();
  await sweepStaleImages();

  const [row] = await getDb().select().from(image).where(eq(image.id, id));
  expect(row.status).toBe("pending");
  expect(row.checkedAt?.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
});

test("the sweep asks about several images at once", async () => {
  const stale = IMAGE_STALE_AFTER_MS / 60_000 + 1 / 60;
  for (const n of [1, 2, 3, 4]) await abandonedImage(stale, `task-slow-${n}`);
  let running = 0;
  let most = 0;
  ai.imageResult.mockImplementation(async () => {
    most = Math.max(most, ++running);
    await new Promise((resolve) => setTimeout(resolve, 20));
    running--;
    return { status: "pending" };
  });

  await sweepStaleImages();

  expect(most).toBeGreaterThan(1);
  expect(most).toBeLessThanOrEqual(4);
});

test("the sweep gives up on images Bailian never finished", async () => {
  const before = await getBalance(userId);
  const lost = await abandonedImage(25 * 60, "task-lost");

  expect((await sweepStaleImages()).failed).toBeGreaterThanOrEqual(1);

  expect(await statuses()).toEqual({ [lost]: "failed" });
  expect(await getBalance(userId)).toBe(before);
});

// Jobs still in flight during a deploy settle with these keys and reasons,
// so changing one would spend, refund or notify twice.
async function ledger(id: string) {
  const db = getDb();
  const credits = await db
    .select({ key: creditTransaction.idempotencyKey, reason: creditTransaction.reason, amount: creditTransaction.amount })
    .from(creditTransaction)
    .where(like(creditTransaction.idempotencyKey, `%:${id}`))
    .orderBy(asc(creditTransaction.createdAt));
  const notes = await db
    .select({ key: notification.key, type: notification.type })
    .from(notification)
    .where(like(notification.key, `%:${id}`));
  return { credits, notes };
}


test.each(["block", "review", "allow"])("Waffo prompt verdict %s gates generation before spending", async (action) => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  vi.stubEnv("PROMPT_MODERATION", "waffo");
  vi.stubEnv("WAFFO_MERCHANT_ID", "MER_2aUyqjCzEIiEcYMKj7TZtw");
  vi.stubEnv("WAFFO_PRIVATE_KEY", privateKey);
  const before = await getBalance(userId);
  vi.stubGlobal("fetch", vi.fn(async () => {
    expect(await getBalance(userId)).toBe(before);
    expect(await rows()).toEqual([]);
    return new Response(JSON.stringify({ data: { action } }));
  }));
  const pending = createImage({ userId, prompt: "A fox", aspect: "1:1" });
  if (action === "allow") {
    await expect(pending).resolves.toMatchObject({ status: "pending" });
    expect(await getBalance(userId)).toBeLessThan(before);
  } else {
    await expect(pending).rejects.toThrow();
    expect(await getBalance(userId)).toBe(before);
    expect(await rows()).toEqual([]);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(ai.submitImage).not.toHaveBeenCalled();
  }
});
