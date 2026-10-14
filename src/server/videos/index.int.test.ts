import { generateKeyPairSync, randomUUID } from "node:crypto";
import { asc, eq, like } from "drizzle-orm";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReferenceVideoJob, VideoJob, VideoProviderId, VideoResult } from "@/server/ai/video";
import { auth } from "@/server/auth";
import { user } from "@/server/auth/schema";
import { getBalance, grantCredits, InsufficientCreditsError, spendCredits } from "@/server/credits";
import { getDb } from "@/server/db";
import type { Email } from "@/server/email/client";
import { creditTransaction } from "@/server/credits/schema";
import { pageNotifications } from "@/server/notifications";
import { notification } from "@/server/notifications/schema";
import { VIDEO_STALE_AFTER_MS } from "./config";
import { video } from "./schema";

// Fake providers and storage. Their own tests cover the HTTP calls.
const { ai, storage } = vi.hoisted(() => {
  class VideoGenerationError extends Error {
    constructor(
      message: string,
      readonly code?: string,
    ) {
      super(message);
    }
  }
  const provider = (id: VideoProviderId) => ({
    id,
    configured: vi.fn(() => true),
    submit: vi.fn<(job: VideoJob) => Promise<string>>(async () => `${id}-req-1`),
    result: vi.fn<(requestId: string) => Promise<VideoResult>>(async () => ({ status: "pending" })),
  });
  const providers = { fal: provider("fal"), seeapi: provider("seeapi"), dashscope: provider("dashscope") };
  const state = { active: "seeapi" as VideoProviderId | null, reference: true };
  const reference = {
    id: "dashscope" as const,
    submit: vi.fn<(job: ReferenceVideoJob) => Promise<string>>(async () => "dashscope-ref-1"),
  };
  return {
    ai: {
      providers,
      reference,
      state,
      module: {
        VideoGenerationError,
        getVideoProvider: (id: VideoProviderId) => providers[id],
        getActiveVideoProvider: () => (state.active ? providers[state.active] : null),
        getReferenceVideoProvider: () => (state.reference ? reference : null),
      },
    },
    storage: {
      storageConfigured: vi.fn(() => true),
      putObject: vi.fn<(key: string, body: Uint8Array, type: string) => Promise<void>>(async () => {}),
      deleteObject: vi.fn<(key: string) => Promise<void>>(async () => {}),
      signedUrl: vi.fn(
        async (key: string, options?: { download?: string }) =>
          `https://storage.test/${key}?signed${options?.download ? `&download=${options.download}` : ""}`,
      ),
    },
  };
});
vi.mock("@/server/ai/video", () => ai.module);
vi.mock("@/server/storage", () => storage);
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn<(email: Email) => Promise<void>>(async () => {}) }));
vi.mock("@/server/email/client", () => ({ sendEmail }));
// The model's lines; rap.test.ts covers writing them.
const writeLyrics = vi.hoisted(() => vi.fn(async (names: string[]) => [`${names[0]} raps`, `${names[1]} raps`]));
vi.mock("./rap", async (importOriginal) => ({ ...(await importOriginal<object>()), writeLyrics }));
// The image check's own tests cover SeeAPI's API.
const moderation = vi.hoisted(() => ({
  enabled: vi.fn(() => false),
  checkImage: vi.fn<(url: string, key: string) => Promise<void>>(async () => {}),
}));
vi.mock("@/server/moderation/image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/moderation/image")>()),
  imageModerationEnabled: moderation.enabled,
  checkImage: moderation.checkImage,
}));
const { ModerationUnavailableError } = await import("@/server/moderation/image");

const {
  createVideo,
  createRapVideo,
  rapOptions,
  countVideos,
  refreshVideo,
  sweepStaleVideos,
  expireUploads,
  listVideos,
  pageVideos,
  getVideo,
  videoDownloadUrl,
  videoOptions,
  VideosDisabledError,
  InvalidVideoRequestError,
  InvalidImageSizeError,
  ContentBlockedError,
} = await import("./index");

const { seeapi, fal } = ai.providers;
// Images with a readable size: a PNG header up to IHDR, and a JPEG with a
// frame header. image-size.test.ts covers reading them.
const be32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const pngOf = (width: number, height: number) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
const jpegOf = (width: number, height: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3]);
const png = pngOf(1280, 720);
const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);
let userId: string;

beforeEach(async () => {
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email: `user-${randomUUID()}@example.com`, name: "Director" },
    { method: "admin" },
  );
  userId = user.id;
  // Enough for a 10-second 720p video on top of the signup credits.
  await grantCredits({ userId, amount: 80, reason: "test", idempotencyKey: randomUUID() });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(mp4, { headers: { "content-type": "video/mp4" } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  ai.state.active = "seeapi";
  ai.state.reference = true;
  for (const provider of [seeapi, fal]) provider.result.mockResolvedValue({ status: "pending" });
  storage.storageConfigured.mockReturnValue(true);
  moderation.enabled.mockReturnValue(false);
});

const rows = () => getDb().select().from(video).where(eq(video.userId, userId));
const create = (
  overrides: Partial<{ prompt: string; duration: number; resolution: string; image: Uint8Array }> = {},
) => createVideo({ userId, prompt: "The fox runs", duration: 5, resolution: "480p", image: png, ...overrides });

test("a prompt on the blocklist spends nothing and never reaches the provider", async () => {
  const before = await getBalance(userId);

  await expect(create({ prompt: "儿童色情 video" })).rejects.toThrow(ContentBlockedError);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toEqual([]);
  expect(seeapi.submit).not.toHaveBeenCalled();
});

test("with image moderation on, checks the stored start image before spending", async () => {
  moderation.enabled.mockReturnValue(true);
  const before = await getBalance(userId);

  const result = await create();

  const imageKey = `videos/${userId}/${result.id}.png`;
  expect(storage.putObject).toHaveBeenCalledTimes(1);
  expect(storage.putObject).toHaveBeenCalledWith(imageKey, png, "image/png");
  expect(moderation.checkImage).toHaveBeenCalledWith(`https://storage.test/${imageKey}?signed`, `video:${result.id}`);
  expect(seeapi.submit).toHaveBeenCalledWith(
    expect.objectContaining({ image: expect.objectContaining({ url: `https://storage.test/${imageKey}?signed` }) }),
  );
  expect(await getBalance(userId)).toBe(before - 20);
  expect(storage.deleteObject).not.toHaveBeenCalled();
});

test.each([
  ["a flagged image is blocked", () => new ContentBlockedError("The image was flagged: explicit"), ContentBlockedError],
  ["a check that fails refuses the upload", () => new ModerationUnavailableError("timed out"), ModerationUnavailableError],
])("%s: spends nothing, records nothing and deletes the image", async (_, error, type) => {
  moderation.enabled.mockReturnValue(true);
  moderation.checkImage.mockRejectedValueOnce(error());
  const before = await getBalance(userId);

  await expect(create()).rejects.toBeInstanceOf(type);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toEqual([]);
  expect(seeapi.submit).not.toHaveBeenCalled();
  const [key] = storage.putObject.mock.calls[0];
  expect(storage.deleteObject).toHaveBeenCalledWith(key);
});

test("with image moderation on, a user without enough credits uploads nothing", async () => {
  moderation.enabled.mockReturnValue(true);
  const balance = await getBalance(userId);
  await spendCredits({ userId, amount: balance - 19, reason: "test", idempotencyKey: randomUUID() });

  await expect(create()).rejects.toThrow(InsufficientCreditsError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(moderation.checkImage).not.toHaveBeenCalled();
});

test.each([
  ["seeapi", "194×259", pngOf(194, 259)],
  ["seeapi", "300×600, under SeeAPI's 301 pixels", pngOf(300, 600)],
  ["seeapi", "1500×500, wider than 2.5:1", pngOf(1500, 500)],
  ["dashscope", "9000×2000, over 8000 pixels", pngOf(9000, 2000)],
] as const)("rejects a %s start image of %s, before uploading or spending", async (id, _, image) => {
  ai.state.active = id;
  const before = await getBalance(userId);

  await expect(create({ image, resolution: "720p" })).rejects.toBeInstanceOf(InvalidImageSizeError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(ai.providers[id].submit).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("accepts a start image at the provider's limits", async () => {
  ai.state.active = "dashscope";
  await expect(create({ image: pngOf(240, 240), resolution: "720p" })).resolves.toMatchObject({ status: "pending" });
});

test("offers the active provider's resolutions with their prices and image limits", () => {
  expect(videoOptions()).toEqual({
    enabled: true,
    resolutions: [
      { value: "480p", creditsPerSecond: 4 },
      { value: "720p", creditsPerSecond: 8 },
      { value: "1080p", creditsPerSecond: 20 },
    ],
    imageLimits: { minSide: 301, maxSide: 5999, maxRatio: 2.5 },
  });
  ai.state.active = "fal";
  expect(videoOptions()?.resolutions.map((r) => r.value)).toEqual(["1080p"]);
  ai.state.active = "dashscope";
  expect(videoOptions()?.resolutions).toEqual([
    { value: "720p", creditsPerSecond: 5 },
    { value: "1080p", creditsPerSecond: 8 },
  ]);
  expect(videoOptions().imageLimits).toEqual({ minSide: 240, maxSide: 8000, maxRatio: 8 });
  ai.state.active = null;
  expect(videoOptions()).toMatchObject({ enabled: false, resolutions: [{ value: "1080p" }] });
  ai.state.active = "seeapi";
  storage.storageConfigured.mockReturnValue(false);
  expect(videoOptions().enabled).toBe(false);
});

test("stores the start image, queues the video and spends the resolution's cost", async () => {
  const before = await getBalance(userId);

  const result = await create({ prompt: "  The fox runs  ", duration: 10, resolution: "720p" });

  const imageKey = `videos/${userId}/${result.id}.png`;
  expect(storage.putObject).toHaveBeenCalledWith(imageKey, png, "image/png");
  expect(seeapi.submit).toHaveBeenCalledWith({
    prompt: "The fox runs",
    duration: 10,
    resolution: "720p",
    image: { bytes: png, mime: "image/png", url: `https://storage.test/${imageKey}?signed` },
    idempotencyKey: `video:${result.id}`,
  });
  expect(result).toMatchObject({
    prompt: "The fox runs",
    duration: 10,
    resolution: "720p",
    credits: 80,
    status: "pending",
    url: null,
    imageUrl: `https://storage.test/${imageKey}?signed`,
  });
  expect(await getBalance(userId)).toBe(before - 80);
  expect(await rows()).toMatchObject([
    { status: "pending", provider: "seeapi", requestId: "seeapi-req-1", imageKey, credits: 80 },
  ]);
});

test("refunds and records the failure when the provider rejects the job", async () => {
  const before = await getBalance(userId);
  seeapi.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("SeeAPI 401"));

  await expect(create()).rejects.toThrow("SeeAPI 401");

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "SeeAPI 401" }]);
});

test.each([
  ["fal", "content_policy_violation", "1080p"],
  ["dashscope", "DataInspectionFailed", "720p"],
] as const)("reports a %s moderation refusal (%s) as a blocked prompt, refunded", async (id, code, resolution) => {
  ai.state.active = id;
  const before = await getBalance(userId);
  ai.providers[id].submit.mockRejectedValueOnce(new ai.module.VideoGenerationError(`${id} 422`, code));

  await expect(create({ resolution })).rejects.toThrow(ContentBlockedError);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: `${id} 422` }]);
});

test("refresh keeps a running video pending", async () => {
  const created = await create();

  const result = await refreshVideo(userId, created.id);

  expect(seeapi.result).toHaveBeenCalledWith("seeapi-req-1");
  expect(result).toMatchObject({ id: created.id, status: "pending", url: null });
});

test("refresh asks the provider that took the job, even after a switch", async () => {
  ai.state.active = "fal";
  const created = await create({ resolution: "1080p" });
  ai.state.active = "seeapi";

  await refreshVideo(userId, created.id);

  expect(fal.result).toHaveBeenCalledWith("fal-req-1");
  expect(seeapi.result).not.toHaveBeenCalled();
});

test("refresh copies a finished video to storage", async () => {
  const created = await create();
  seeapi.result.mockResolvedValueOnce({ status: "succeeded", url: "https://seeapi.test/out.mp4" });

  const result = await refreshVideo(userId, created.id);

  const key = `videos/${userId}/${created.id}.mp4`;
  expect(fetch).toHaveBeenCalledWith("https://seeapi.test/out.mp4", expect.anything());
  expect(storage.putObject).toHaveBeenCalledWith(key, mp4, "video/mp4");
  expect(result).toMatchObject({ status: "succeeded", url: `https://storage.test/${key}?signed` });
  expect(await rows()).toMatchObject([{ status: "succeeded", storageKey: key }]);

  // A finished video isn't checked again.
  await refreshVideo(userId, created.id);
  expect(seeapi.result).toHaveBeenCalledTimes(1);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "video_succeeded", data: { videoId: created.id, prompt: "The fox runs" } },
  ]);
});

test("counts only the user's finished videos", async () => {
  const done = await create();
  await create();
  seeapi.result.mockResolvedValueOnce({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  await refreshVideo(userId, done.id);

  expect(await countVideos(userId)).toBe(1);
  expect(await countVideos(randomUUID())).toBe(0);
});

test("refresh refunds what was spent on a failed video, once", async () => {
  const before = await getBalance(userId);
  const created = await create({ duration: 10, resolution: "720p" });
  seeapi.result.mockResolvedValue({ status: "failed", code: "failed", error: "SeeAPI task failed" });

  const result = await refreshVideo(userId, created.id);
  await refreshVideo(userId, created.id);

  expect(result).toMatchObject({ status: "failed", url: null });
  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", error: "SeeAPI task failed" }]);
  expect((await pageNotifications(userId)).notifications).toMatchObject([
    { type: "video_failed", data: { videoId: created.id, prompt: "The fox runs", credits: 80 } },
  ]);
});

test("keeps the credit and notification keys that videos in flight rely on", async () => {
  const created = await create({ duration: 10, resolution: "720p" });
  seeapi.result.mockResolvedValue({ status: "failed", code: "failed", error: "SeeAPI task failed" });
  await refreshVideo(userId, created.id);

  expect(await ledger(created.id)).toEqual({
    credits: [
      { key: `video:${created.id}`, reason: "video", amount: -80 },
      { key: `video-refund:${created.id}`, reason: "video refund", amount: 80 },
    ],
    notes: [{ key: `video:${created.id}`, type: "video_failed" }],
  });
});

test("refresh leaves the video pending when copying it fails, so a later refresh retries", async () => {
  const created = await create();
  seeapi.result.mockResolvedValue({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  storage.putObject.mockRejectedValueOnce(new Error("bucket gone"));

  await expect(refreshVideo(userId, created.id)).rejects.toThrow("bucket gone");
  expect(await rows()).toMatchObject([{ status: "pending" }]);

  expect(await refreshVideo(userId, created.id)).toMatchObject({ status: "succeeded" });
});

test("refresh finds only the user's own videos", async () => {
  const created = await create();

  expect(await refreshVideo(randomUUID(), created.id)).toBeNull();
  expect(await refreshVideo(userId, randomUUID())).toBeNull();
});

test("without enough credits, calls nothing and records nothing", async () => {
  const balance = await getBalance(userId);
  await spendCredits({ userId, amount: balance - 19, reason: "test", idempotencyKey: randomUUID() });

  await expect(create()).rejects.toThrow(InsufficientCreditsError);

  expect(storage.putObject).not.toHaveBeenCalled();
  expect(seeapi.submit).not.toHaveBeenCalled();
  expect(await rows()).toEqual([]);
});

test.each([
  { name: "a blank prompt", input: { prompt: "   " } },
  { name: "a long prompt", input: { prompt: "x".repeat(2001) } },
  { name: "an unknown duration", input: { duration: 7 } },
  { name: "a resolution the provider lacks", input: { resolution: "4k" } },
  { name: "an inherited property as resolution", input: { resolution: "toString" } },
  { name: "a file that isn't an image", input: { image: new TextEncoder().encode("<html>") } },
  { name: "an image over 4 MB", input: { image: new Uint8Array(4 * 1024 * 1024 + 1).fill(0xff) } },
  { name: "an image whose size can't be read", input: { image: png.slice(0, 12) } },
])("rejects $name", async ({ input }) => {
  await expect(create(input)).rejects.toThrow(InvalidVideoRequestError);
  expect(seeapi.submit).not.toHaveBeenCalled();
});

test("is off without an active provider or storage", async () => {
  ai.state.active = null;
  await expect(create()).rejects.toThrow(VideosDisabledError);

  ai.state.active = "seeapi";
  storage.storageConfigured.mockReturnValue(false);
  await expect(create()).rejects.toThrow(VideosDisabledError);
});

test("lists only the user's videos, newest first, signing only stored ones", async () => {
  const first = await create({ prompt: "first" });
  seeapi.result.mockResolvedValueOnce({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  await refreshVideo(userId, first.id);
  await create({ prompt: "second" });

  const list = await listVideos(userId);

  expect(list.map((v) => v.prompt)).toEqual(["second", "first"]);
  expect(list[0]).toMatchObject({ status: "pending", url: null, imageUrl: expect.any(String) });
  expect(list[1]).toMatchObject({ id: first.id, url: expect.stringContaining(`${first.id}.mp4`) });
  expect(list[0]).not.toHaveProperty("error");
  expect(list[0]).not.toHaveProperty("provider");
  expect(await listVideos(randomUUID())).toEqual([]);
});

test("pages through the user's videos, newest first, counting them all", async () => {
  const first = await create({ prompt: "first" });
  await create({ prompt: "second" });
  await create({ prompt: "third" });

  const one = await pageVideos(userId, 1, 2);
  const two = await pageVideos(userId, 2, 2);

  expect(one.total).toBe(3);
  expect(one.videos.map((v) => v.prompt)).toEqual(["third", "second"]);
  expect(two).toMatchObject({ total: 3, videos: [{ id: first.id, imageUrl: expect.any(String) }] });
  expect(await pageVideos(userId, 3, 2)).toEqual({ videos: [], total: 3 });
  expect(await pageVideos(randomUUID())).toEqual({ videos: [], total: 0 });
});

async function finishedVideo() {
  const created = await create();
  seeapi.result.mockResolvedValueOnce({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  return (await refreshVideo(userId, created.id))!;
}

test("gets one of the user's videos without asking the provider", async () => {
  const done = await finishedVideo();
  const pending = await create({ prompt: "pending" });
  seeapi.result.mockClear();

  expect(await getVideo(userId, done.id)).toMatchObject({ id: done.id, url: expect.stringContaining(done.id) });
  expect(await getVideo(userId, pending.id)).toMatchObject({ status: "pending", url: null });
  expect(seeapi.result).not.toHaveBeenCalled();
  expect(await getVideo(randomUUID(), done.id)).toBeNull();
  expect(await getVideo(userId, "not-an-id")).toBeNull();
});

test("signs a download only for the user's stored videos", async () => {
  const done = await finishedVideo();
  const pending = await create({ prompt: "pending" });

  expect(await videoDownloadUrl(userId, done.id)).toBe(
    `https://storage.test/videos/${userId}/${done.id}.mp4?signed&download=video-${done.id}.mp4`,
  );
  expect(await videoDownloadUrl(userId, pending.id)).toBeNull();
  expect(await videoDownloadUrl(randomUUID(), done.id)).toBeNull();
});

// A video whose request crashed (no requestId) or whose page was closed.
async function staleVideo(minutesAgo: number, requestId: string | null) {
  const id = randomUUID();
  await spendCredits({ userId, amount: 20, reason: "video", idempotencyKey: `video:${id}` });
  await getDb().insert(video).values({
    id,
    userId,
    prompt: "Lost",
    duration: 5,
    provider: "seeapi",
    resolution: "480p",
    credits: 20,
    requestId,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
  return id;
}

const statusOf = async (id: string) =>
  (await getDb().select({ status: video.status }).from(video).where(eq(video.id, id)))[0]?.status;

test("the sweep fails and refunds a video that was never submitted, once", async () => {
  const before = await getBalance(userId);
  const stale = await staleVideo(20, null);
  const fresh = await staleVideo(1, null);

  await sweepStaleVideos();
  await sweepStaleVideos();

  expect(await statusOf(stale)).toBe("failed");
  expect(await statusOf(fresh)).toBe("pending");
  expect(await getBalance(userId)).toBe(before - 20);
});

test("the sweep collects a finished video nobody polled", async () => {
  seeapi.result.mockResolvedValue({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  // A second past the stale age, so it's the newest stale video: the sweep
  // takes only the newest VIDEO_SWEEP_BATCH, and earlier runs leave pending
  // videos in the shared database that turn stale later.
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `seeapi-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("succeeded");
  expect(storage.putObject).toHaveBeenCalledWith(`videos/${userId}/${id}.mp4`, mp4, "video/mp4");
});

// Emails sent to this test's user. The database is shared, so the sweep
// may settle other tests' videos too. The links need the site URL, which
// CI has no .env for.
const emailsToUser = async () => {
  const [{ email }] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
  return sendEmail.mock.calls.map(([sent]) => sent).filter((sent) => sent.to === email);
};

test("the sweep emails the owner of a video nobody was watching, once", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  seeapi.result.mockResolvedValue({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `seeapi-${randomUUID()}`);

  await sweepStaleVideos();
  await refreshVideo(userId, id);

  const sent = await emailsToUser();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ subject: expect.stringContaining("video is ready") });
  expect(sent[0]).toMatchObject({ text: expect.stringContaining(`/videos/${id}`) });
});

test("the sweep emails the owner when it gives up on a video", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  const id = await staleVideo(25 * 60, `seeapi-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("failed");
  const sent = await emailsToUser();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ text: expect.stringContaining("20 credits were refunded") });
});

test("a video the user's page collects sends no email", async () => {
  const created = await create();
  seeapi.result.mockResolvedValueOnce({ status: "succeeded", url: "https://seeapi.test/out.mp4" });

  await refreshVideo(userId, created.id);

  expect(await statusOf(created.id)).toBe("succeeded");
  expect(await emailsToUser()).toEqual([]);
});

test("a lost email doesn't stop the sweep", async () => {
  sendEmail.mockRejectedValue(new Error("Resend down"));
  seeapi.result.mockResolvedValue({ status: "succeeded", url: "https://seeapi.test/out.mp4" });
  const id = await staleVideo(VIDEO_STALE_AFTER_MS / 60_000 + 1 / 60, `seeapi-${randomUUID()}`);

  await expect(sweepStaleVideos()).resolves.toBeDefined();

  expect(await statusOf(id)).toBe("succeeded");
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => {});
});

test("the sweep gives up on a provider job after a day and refunds it", async () => {
  const before = await getBalance(userId);
  const id = await staleVideo(25 * 60, `seeapi-${randomUUID()}`);

  await sweepStaleVideos();

  expect(await statusOf(id)).toBe("failed");
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

const jpeg = jpegOf(1280, 720);
const rap = (overrides: Partial<{ names: [string, string]; images: [Uint8Array, Uint8Array] }> = {}) =>
  createRapVideo({ userId, names: ["Ada", "Bo"], images: [jpeg, png], language: "en", ...overrides });

test("the rap duo is on with a Bailian key and storage, whatever VIDEO_PROVIDER says", () => {
  ai.state.active = null;
  expect(rapOptions()).toEqual({ enabled: true, credits: 75 });
  ai.state.reference = false;
  expect(rapOptions().enabled).toBe(false);
  ai.state.reference = true;
  storage.storageConfigured.mockReturnValue(false);
  expect(rapOptions().enabled).toBe(false);
});

test("a rap video stores both photos, queues one Wan 3.0 job with the lines and spends 75 credits", async () => {
  const before = await getBalance(userId);

  const result = await rap({ names: ["  Ada ", "Bo"] });

  const first = `videos/${userId}/${result.id}.jpg`;
  const second = `videos/${userId}/${result.id}-2.png`;
  expect(storage.putObject).toHaveBeenCalledWith(first, jpeg, "image/jpeg");
  expect(storage.putObject).toHaveBeenCalledWith(second, png, "image/png");
  expect(writeLyrics).toHaveBeenCalledWith(["Ada", "Bo"], "en");
  const job = ai.reference.submit.mock.calls[0][0];
  expect(job).toMatchObject({
    images: [
      { bytes: jpeg, mime: "image/jpeg", url: `https://storage.test/${first}?signed` },
      { bytes: png, mime: "image/png", url: `https://storage.test/${second}?signed` },
    ],
    duration: 15,
    resolution: "720p",
    ratio: "16:9",
  });
  expect(job.prompt).toContain('图1 raps: "Ada raps"');
  expect(job.prompt).toContain('图2 raps: "Bo raps"');
  expect(result).toMatchObject({
    prompt: "Ada & Bo: Ada raps / Bo raps",
    duration: 15,
    resolution: "720p",
    credits: 75,
    status: "pending",
    imageUrl: `https://storage.test/${first}?signed`,
  });
  expect(await getBalance(userId)).toBe(before - 75);
  expect(await rows()).toMatchObject([
    { provider: "dashscope", requestId: "dashscope-ref-1", imageKey: first, credits: 75 },
  ]);
});

test("a rap video finishes through the dashscope provider, like any video", async () => {
  const created = await rap();
  ai.providers.dashscope.result.mockResolvedValueOnce({ status: "succeeded", url: "https://dashscope.test/out.mp4" });

  const result = await refreshVideo(userId, created.id);

  expect(ai.providers.dashscope.result).toHaveBeenCalledWith("dashscope-ref-1");
  expect(result).toMatchObject({ status: "succeeded", url: `https://storage.test/videos/${userId}/${created.id}.mp4?signed` });
});

test.each([
  ["an empty name", { names: ["Ada", "  "] }],
  ["a name too long", { names: ["Ada", "x".repeat(31)] }],
  ["a photo that isn't an image", { images: [jpeg, new Uint8Array([1, 2, 3])] }],
  ["a photo over 2 MB", { images: [jpeg, new Uint8Array(2 * 1024 * 1024 + 1).fill(0xff)] }],
] as const)("rejects %s and spends nothing", async (_, overrides) => {
  const before = await getBalance(userId);

  await expect(rap(overrides as never)).rejects.toThrow(InvalidVideoRequestError);

  expect(await getBalance(userId)).toBe(before);
  expect(ai.reference.submit).not.toHaveBeenCalled();
});

test("a rap photo Bailian would refuse spends nothing and writes no lines", async () => {
  const before = await getBalance(userId);

  await expect(rap({ images: [jpeg, pngOf(194, 259)] })).rejects.toBeInstanceOf(InvalidImageSizeError);

  expect(writeLyrics).not.toHaveBeenCalled();
  expect(storage.putObject).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toBe(before);
});

test("a blocked name spends nothing and writes no lines", async () => {
  await expect(rap({ names: ["儿童色情", "Bo"] })).rejects.toThrow(ContentBlockedError);

  expect(writeLyrics).not.toHaveBeenCalled();
  expect(await rows()).toEqual([]);
});

test("the rap duo is off without a Bailian key", async () => {
  ai.state.reference = false;

  await expect(rap()).rejects.toThrow(VideosDisabledError);
});

test("a rap video Bailian's moderation refuses is refunded and reported as blocked", async () => {
  const before = await getBalance(userId);
  ai.reference.submit.mockRejectedValueOnce(new ai.module.VideoGenerationError("Bailian 400", "IPInfringementSuspect"));

  await expect(rap()).rejects.toThrow(ContentBlockedError);

  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toMatchObject([{ status: "failed", credits: 75 }]);
});

test("with image moderation on, both rap photos are checked first; a flagged one spends nothing, writes no lines and deletes both", async () => {
  moderation.enabled.mockReturnValue(true);
  moderation.checkImage
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new ContentBlockedError("The image was flagged: explicit"));
  const before = await getBalance(userId);

  await expect(rap()).rejects.toThrow(ContentBlockedError);

  const keys = storage.putObject.mock.calls.map(([key]) => key);
  expect(keys).toHaveLength(2);
  expect(moderation.checkImage).toHaveBeenCalledTimes(2);
  expect(moderation.checkImage.mock.calls.map(([url]) => url)).toEqual(
    keys.map((key) => `https://storage.test/${key}?signed`),
  );
  expect(storage.deleteObject.mock.calls.map(([key]) => key)).toEqual(keys);
  expect(await getBalance(userId)).toBe(before);
  expect(await rows()).toEqual([]);
  expect(writeLyrics).not.toHaveBeenCalled();
  expect(ai.reference.submit).not.toHaveBeenCalled();
});

test("with image moderation on, checked rap photos are stored once and submitted", async () => {
  moderation.enabled.mockReturnValue(true);

  await rap();

  expect(storage.putObject).toHaveBeenCalledTimes(2);
  expect(moderation.checkImage).toHaveBeenCalledTimes(2);
  expect(ai.reference.submit).toHaveBeenCalledTimes(1);
});

// A video whose uploads were stored `hoursAgo`. The database is shared, so
// tests look only at their own rows and run the sweep until it is done.
async function uploadedVideo(hoursAgo: number, { rap = false } = {}) {
  const id = randomUUID();
  await getDb()
    .insert(video)
    .values({
      id,
      userId,
      prompt: "Old",
      duration: rap ? 15 : 5,
      provider: rap ? "dashscope" : "seeapi",
      resolution: "720p",
      credits: 20,
      status: "succeeded",
      requestId: "req",
      imageKey: `videos/${userId}/${id}.jpg`,
      createdAt: new Date(Date.now() - hoursAgo * 60 * 60_000),
    });
  return id;
}

async function expireAll() {
  for (let i = 0; i < 50 && (await expireUploads()) > 0; i++);
}

const imageKeyOf = async (id: string) =>
  (await getDb().select({ imageKey: video.imageKey }).from(video).where(eq(video.id, id)))[0]?.imageKey;

test("deletes uploads after a day, keeping the video and newer uploads", async () => {
  const old = await uploadedVideo(25);
  const fresh = await uploadedVideo(23);

  await expireAll();

  expect(await imageKeyOf(old)).toBeNull();
  expect(await imageKeyOf(fresh)).toBe(`videos/${userId}/${fresh}.jpg`);
  const deleted = storage.deleteObject.mock.calls.map(([key]) => key);
  expect(deleted).toContain(`videos/${userId}/${old}.jpg`);
  expect(deleted.filter((key) => key.includes(fresh))).toEqual([]);
  expect(await statusOf(old)).toBe("succeeded");
});

test("deletes a rap duo's second photo too, whatever its type", async () => {
  const id = await uploadedVideo(25, { rap: true });

  await expireAll();

  const deleted = storage.deleteObject.mock.calls.map(([key]) => key).filter((key) => key.includes(id));
  expect(deleted.sort()).toEqual(
    [`${id}.jpg`, `${id}-2.jpg`, `${id}-2.png`, `${id}-2.webp`].map((name) => `videos/${userId}/${name}`).sort(),
  );
  expect(await imageKeyOf(id)).toBeNull();
});

test("an upload that can't be deleted keeps its key, so a later run retries", async () => {
  const id = await uploadedVideo(25);
  storage.deleteObject.mockImplementation(async (key) => {
    if (key.includes(id)) throw new Error("storage down");
  });

  await expireUploads();

  expect(await imageKeyOf(id)).toBe(`videos/${userId}/${id}.jpg`);
  storage.deleteObject.mockImplementation(async () => {});
  await expireAll();
  expect(await imageKeyOf(id)).toBeNull();
});


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
  const pending = create();
  if (action === "allow") {
    await expect(pending).resolves.toMatchObject({ status: "pending" });
    expect(await getBalance(userId)).toBeLessThan(before);
  } else {
    await expect(pending).rejects.toThrow();
    expect(await getBalance(userId)).toBe(before);
    expect(await rows()).toEqual([]);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(seeapi.submit).not.toHaveBeenCalled();
  }
});
