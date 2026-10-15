import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import {
  getActiveVideoProvider,
  getReferenceVideoProvider,
  getVideoProvider,
  VideoGenerationError,
} from "@/server/ai/video";
import { user } from "@/server/auth/schema";
import { getBalance, InsufficientCreditsError } from "@/server/credits";
import { getDb } from "@/server/db";
import { type Email, sendEmail } from "@/server/email/client";
import { videoFailedEmail, videoReadyEmail } from "@/server/email/templates/video";
import { lifecycle } from "@/server/generations";
import { log } from "@/server/log";
import { checkPrompt, ContentBlockedError } from "@/server/moderation";
import { screenPrompt } from "@/server/moderation/prompt";
import { checkImage, imageModerationEnabled, ModerationUnavailableError } from "@/server/moderation/image";
import { deleteObject, putObject, signedUrl, storageConfigured } from "@/server/storage";
import {
  MAX_IMAGE_BYTES,
  MAX_PROMPT_LENGTH,
  RAP_CREDITS,
  RAP_DURATION,
  RAP_IMAGE_LIMITS,
  RAP_MAX_IMAGE_BYTES,
  RAP_MAX_NAME_LENGTH,
  RAP_RATIO,
  RAP_RESOLUTION,
  ZOMBIE_CREDITS,
  ZOMBIE_RATIO,
  ZOMBIE_TITLE,
  UPLOAD_EXPIRY_BATCH,
  UPLOAD_RETENTION_MS,
  VIDEO_DURATIONS,
  VIDEO_GIVE_UP_AFTER_MS,
  VIDEO_IMAGE_LIMITS,
  VIDEO_RESOLUTIONS,
  VIDEO_STALE_AFTER_MS,
  VIDEO_SWEEP_BATCH,
  VIDEOS_PAGE_SIZE,
  type VideoDuration,
  videoCost,
} from "./config";
import { type RapLanguage, type RapLines, rapPrompt, writeLyrics } from "./rap";
import { zombiePrompt } from "./zombie";
import { checkImageSize, type ImageLimits, imageSize } from "./image-size";
import { video } from "./schema";

export class VideosDisabledError extends Error {
  constructor() {
    super("Video generation is off: set VIDEO_PROVIDER, its key and the STORAGE_* variables");
  }
}

export class InvalidVideoRequestError extends Error {}

// The image's pixel size is outside what the provider accepts.
export class InvalidImageSizeError extends Error {
  constructor(readonly limits: ImageLimits) {
    super(`Each side must be ${limits.minSide}-${limits.maxSide} pixels, at most ${limits.maxRatio}:1`);
  }
}

export { ContentBlockedError, ModerationUnavailableError };

// Providers' codes for a prompt or image their moderation refused: fal's
// error type, and Bailian's codes (as for images).
const BLOCKED_CODES = new Set(["content_policy_violation", "DataInspectionFailed", "IPInfringementSuspect"]);

export type Video = {
  id: string;
  prompt: string;
  duration: number;
  resolution: string;
  // Credits spent, refunded if the video failed.
  credits: number;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  // Signed URLs, valid for an hour. url is null until the MP4 is stored.
  url: string | null;
  imageUrl: string | null;
};

type Row = typeof video.$inferSelect;

const videos = lifecycle({
  name: "video",
  table: video,
  jobColumn: video.requestId,
  jobId: (row) => row.requestId,
  credits: (row) => row.credits,
  // The provider that took the job, even if VIDEO_PROVIDER changed since.
  poll: (row, requestId) => getVideoProvider(row.provider).result(requestId),
  output: { ext: "mp4", mime: "video/mp4", timeoutMs: 120_000, error: (message) => new VideoGenerationError(message) },
  notification: {
    succeeded: (row) => ({ type: "video_succeeded", data: { videoId: row.id, prompt: row.prompt } }),
    failed: (row, credits) => ({ type: "video_failed", data: { videoId: row.id, prompt: row.prompt, credits } }),
  },
  unwatched: {
    succeeded: (row) => emailOwner(row.userId, (to, base) => videoReadyEmail(to, row.prompt, `${base}/videos/${row.id}`)),
    failed: (row, credits) =>
      emailOwner(row.userId, (to, base) => videoFailedEmail(to, row.prompt, credits, `${base}/videos`)),
  },
  neverFinished: "Provider never finished",
  stale: { afterMs: VIDEO_STALE_AFTER_MS, giveUpAfterMs: VIDEO_GIVE_UP_AFTER_MS, batch: VIDEO_SWEEP_BATCH },
});

// What the active provider offers: its resolutions, lowest first, with their
// price. While video generation is off, shows fal's as an example.
export function videoOptions(): {
  enabled: boolean;
  resolutions: { value: string; creditsPerSecond: number }[];
  imageLimits: ImageLimits;
} {
  const provider = getActiveVideoProvider();
  return {
    enabled: provider !== null && storageConfigured(),
    imageLimits: VIDEO_IMAGE_LIMITS[provider?.id ?? "fal"],
    resolutions: Object.entries(VIDEO_RESOLUTIONS[provider?.id ?? "fal"]).map(
      ([value, creditsPerSecond]) => ({ value, creditsPerSecond }),
    ),
  };
}

// Spends the cost, stores the start image and queues the video with the
// active provider. With IMAGE_MODERATION on, the image is stored and
// checked first; a flagged image, or a check that gives no verdict, spends
// nothing and is deleted.
// The video finishes minutes later; refreshVideo collects it. Any failure
// refunds the cost, with an idempotency key per video so it refunds once.
export async function createVideo(input: {
  userId: string;
  prompt: string;
  duration: number;
  resolution: string;
  image: Uint8Array;
}): Promise<Video> {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new InvalidVideoRequestError(`Prompt must be 1-${MAX_PROMPT_LENGTH} characters`);
  }
  if (!isDuration(input.duration)) {
    throw new InvalidVideoRequestError(`Unknown duration: ${input.duration}`);
  }
  if (input.image.byteLength > MAX_IMAGE_BYTES) {
    throw new InvalidVideoRequestError(`The image must be at most ${MAX_IMAGE_BYTES} bytes`);
  }
  const type = imageType(input.image);
  if (!type) throw new InvalidVideoRequestError("The image must be a JPEG, PNG or WebP");
  const provider = getActiveVideoProvider();
  if (!provider || !storageConfigured()) throw new VideosDisabledError();
  assertImageSize(input.image, VIDEO_IMAGE_LIMITS[provider.id]);
  const { userId, duration, resolution } = input;
  const credits = videoCost(provider.id, resolution, duration);
  if (credits === null) throw new InvalidVideoRequestError(`Unknown resolution: ${resolution}`);
  await screenPrompt(prompt);

  const id = randomUUID();
  const imageKey = videos.fileKey(userId, id, type.ext);
  const files = [{ key: imageKey, bytes: input.image, mime: type.mime }];
  const moderated = await storeAndCheck(userId, id, credits, files);

  const db = getDb();
  try {
    const row = await videos.start(
      { userId, id, credits },
      (tx) => tx.insert(video).values({ id, userId, prompt, duration, provider: provider.id, resolution, credits }),
      async () => {
        if (!moderated) await storeFiles(files);
        const requestId = await provider.submit({
          prompt,
          duration,
          resolution,
          image: { bytes: input.image, mime: type.mime, url: await signedUrl(imageKey) },
          idempotencyKey: `video:${id}`,
        });
        const [submitted] = await db
          .update(video)
          .set({ requestId, imageKey })
          .where(eq(video.id, id))
          .returning();
        return submitted;
      },
    );
    return withUrls(row);
  } catch (error) {
    if (moderated) await removeUnpaid(error, files);
    throw blocked(error);
  }
}

// A provider's moderation refusal becomes ContentBlockedError.
function blocked(error: unknown): unknown {
  return error instanceof VideoGenerationError && error.code && BLOCKED_CODES.has(error.code)
    ? new ContentBlockedError(error.message, { cause: error })
    : error;
}

// The rap duo and the zombie couple need Bailian and storage, whatever
// VIDEO_PROVIDER says.
function duoEnabled() {
  return getReferenceVideoProvider() !== null && storageConfigured();
}

export function rapOptions(): { enabled: boolean; credits: number } {
  return { enabled: duoEnabled(), credits: RAP_CREDITS };
}

export function zombieOptions(): { enabled: boolean; credits: number } {
  return { enabled: duoEnabled(), credits: ZOMBIE_CREDITS };
}

// Two photos and two names become a 15-second video where each person raps
// a line written for them.
export async function createRapVideo(input: {
  userId: string;
  names: RapLines;
  images: [Uint8Array, Uint8Array];
  language: RapLanguage;
}): Promise<Video> {
  const names = input.names.map((name) => name.trim()) as RapLines;
  if (names.some((name) => !name || name.length > RAP_MAX_NAME_LENGTH)) {
    throw new InvalidVideoRequestError(`Names must be 1-${RAP_MAX_NAME_LENGTH} characters`);
  }
  return createDuoVideo({
    userId: input.userId,
    images: input.images,
    text: names.join("\n"),
    credits: RAP_CREDITS,
    ratio: RAP_RATIO,
    // The model can take seconds, and never throws.
    prompt: async () => {
      const lines = await writeLyrics(names, input.language);
      return { title: `${names[0]} & ${names[1]}: ${lines[0]} / ${lines[1]}`, prompt: rapPrompt(lines) };
    },
  });
}

// Two photos become a 15-second vertical video: the survivor (the first
// photo) hugs their partner (the second), now a zombie.
export function createZombieVideo(input: { userId: string; images: [Uint8Array, Uint8Array] }): Promise<Video> {
  return createDuoVideo({
    ...input,
    text: null,
    credits: ZOMBIE_CREDITS,
    ratio: ZOMBIE_RATIO,
    prompt: async () => ({ title: ZOMBIE_TITLE, prompt: zombiePrompt() }),
  });
}

// Two photos, the first on the left, become one Wan 3.0 video. Stored and
// finished like any video: the first photo is its image, and the
// "dashscope" provider polls the job. `text`, the user's words, is checked
// before anything is stored; `prompt` runs once the photos pass moderation,
// before credits are spent, and gives the stored title and the model's prompt.
async function createDuoVideo(input: {
  userId: string;
  images: [Uint8Array, Uint8Array];
  text: string | null;
  credits: number;
  ratio: string;
  prompt: () => Promise<{ title: string; prompt: string }>;
}): Promise<Video> {
  const images = input.images.map((bytes) => {
    const type = imageType(bytes);
    if (!type || bytes.byteLength > RAP_MAX_IMAGE_BYTES) {
      throw new InvalidVideoRequestError(`Each photo must be a JPEG, PNG or WebP up to ${RAP_MAX_IMAGE_BYTES} bytes`);
    }
    return { bytes, ...type };
  });
  const provider = getReferenceVideoProvider();
  if (!provider || !storageConfigured()) throw new VideosDisabledError();
  for (const { bytes } of images) assertImageSize(bytes, RAP_IMAGE_LIMITS);
  if (input.text !== null) checkPrompt(input.text);

  const { userId, credits } = input;
  const id = randomUUID();
  const imageKey = videos.fileKey(userId, id, images[0].ext);
  const files = [
    { key: imageKey, bytes: images[0].bytes, mime: images[0].mime },
    { key: videos.fileKey(userId, `${id}-2`, images[1].ext), bytes: images[1].bytes, mime: images[1].mime },
  ];
  const moderated = await storeAndCheck(userId, id, credits, files);
  const { title, prompt } = await input.prompt();
  const db = getDb();
  try {
    const row = await videos.start(
      { userId, id, credits },
      (tx) =>
        tx.insert(video).values({
          id,
          userId,
          prompt: title,
          duration: RAP_DURATION,
          provider: provider.id,
          resolution: RAP_RESOLUTION,
          credits,
        }),
      async () => {
        if (!moderated) await storeFiles(files);
        const requestId = await provider.submit({
          prompt,
          images: await Promise.all(
            images.map(async ({ bytes, mime }, index) => ({
              bytes,
              mime,
              url: await signedUrl(files[index].key),
            })),
          ),
          duration: RAP_DURATION,
          resolution: RAP_RESOLUTION,
          ratio: input.ratio,
        });
        const [submitted] = await db
          .update(video)
          .set({ requestId, imageKey })
          .where(eq(video.id, id))
          .returning();
        return submitted;
      },
    );
    return withUrls(row);
  } catch (error) {
    if (moderated) await removeUnpaid(error, files);
    throw blocked(error);
  }
}

type StoredFile = { key: string; bytes: Uint8Array; mime: string };

// Emails the video's owner. The links have no locale: the app redirects
// them to the reader's. A lost email is logged, never thrown.
async function emailOwner(userId: string, email: (to: string, base: string) => Email) {
  try {
    const [found] = await getDb().select({ email: user.email }).from(user).where(eq(user.id, userId));
    if (!found) return;
    await sendEmail(email(found.email, new URL(process.env.BETTER_AUTH_URL ?? "").origin));
  } catch (error) {
    log.error("video.email_failed", { userId, error });
  }
}

async function storeFiles(files: StoredFile[]) {
  for (const { key, bytes, mime } of files) await putObject(key, bytes, mime);
}

async function removeFiles(files: StoredFile[]) {
  for (const { key } of files) {
    await deleteObject(key).catch((error) => log.error("video.image_not_deleted", { key, error }));
  }
}

// With IMAGE_MODERATION on, stores the uploaded images and checks each one
// before anything is spent; a flagged image, or a check that gives no
// verdict, deletes them all and throws. Returns whether it stored them, so
// the submission doesn't store them again.
async function storeAndCheck(userId: string, id: string, credits: number, files: StoredFile[]): Promise<boolean> {
  if (!imageModerationEnabled()) return false;
  // Spending checks again; this only spares an upload that can't be paid for.
  if ((await getBalance(userId)) < credits) throw new InsufficientCreditsError();
  await storeFiles(files);
  try {
    for (const [index, file] of files.entries()) {
      await checkImage(await signedUrl(file.key), index === 0 ? `video:${id}` : `video:${id}:${index + 1}`);
    }
  } catch (error) {
    await removeFiles(files);
    throw error;
  }
  return true;
}

// Spending failed before the job existed, so the checked images have no row.
async function removeUnpaid(error: unknown, files: StoredFile[]) {
  if (error instanceof InsufficientCreditsError) await removeFiles(files);
}

// Returns the user's video, first asking its provider about a pending one.
// A finished video is copied to storage; a failed one is refunded. Null if
// not found. Throws if the provider or storage fails, leaving the video
// pending for a retry.
export async function refreshVideo(userId: string, id: string): Promise<Video | null> {
  const row = await videos.refresh(userId, id);
  return row ? withUrls(row) : null;
}

// Returns the user's video as stored, without asking its provider. Null if
// not found.
export async function getVideo(userId: string, id: string): Promise<Video | null> {
  const row = await videos.get(userId, id);
  return row ? withUrls(row) : null;
}

// A signed URL that downloads the user's stored video as a file. Null if
// not found or not stored.
export async function videoDownloadUrl(userId: string, id: string): Promise<string | null> {
  const key = await videos.storedKey(userId, id);
  return key ? signedUrl(key, { download: `video-${id}.mp4` }) : null;
}

// Settles videos left pending: fails and refunds those never submitted (a
// crash) or that their provider hasn't finished in a day, and collects
// finished ones nobody polled for. Returns how many it failed and checked.
export function sweepStaleVideos(now = new Date()): Promise<{ failed: number; checked: number }> {
  return videos.sweep(now);
}

// The extensions imageType gives, for the second photo of a rap duo or a
// zombie couple, whose key isn't stored. Deleting a key that doesn't exist succeeds.
const IMAGE_EXTS = ["jpg", "png", "webp"];

// Deletes uploaded photos older than UPLOAD_RETENTION_MS, oldest first, and
// clears the video's imageKey; the MP4 stays. A video whose upload can't be
// deleted keeps its key, so a later run retries. Returns how many videos it
// cleared.
export async function expireUploads(now = new Date()): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: video.id, userId: video.userId, imageKey: video.imageKey, duration: video.duration })
    .from(video)
    .where(and(isNotNull(video.imageKey), lt(video.createdAt, new Date(now.getTime() - UPLOAD_RETENTION_MS))))
    .orderBy(asc(video.createdAt))
    .limit(UPLOAD_EXPIRY_BATCH);

  let cleared = 0;
  for (const row of rows) {
    const keys = [row.imageKey as string];
    // Only the two-photo videos are RAP_DURATION long.
    if (row.duration === RAP_DURATION) {
      keys.push(...IMAGE_EXTS.map((ext) => videos.fileKey(row.userId, `${row.id}-2`, ext)));
    }
    try {
      for (const key of keys) await deleteObject(key);
    } catch (error) {
      log.error("video.upload_not_deleted", { id: row.id, error });
      continue;
    }
    await db.update(video).set({ imageKey: null }).where(eq(video.id, row.id));
    cleared++;
  }
  return cleared;
}

// Finished videos only.
export function countVideos(userId: string): Promise<number> {
  return videos.count(userId);
}

export async function listVideos(userId: string, limit = 24): Promise<Video[]> {
  return Promise.all((await videos.list(userId, limit)).map(withUrls));
}

// One page of the user's videos, newest first. `total` counts them all, so
// the page can link to the rest.
export async function pageVideos(
  userId: string,
  page = 1,
  pageSize = VIDEOS_PAGE_SIZE,
): Promise<{ videos: Video[]; total: number }> {
  const { rows, total } = await videos.page(userId, page, pageSize);
  return { videos: await Promise.all(rows.map(withUrls)), total };
}

// How videos created between `since` and `until` went, for /admin/metrics.
export function videoMetrics(window: { since: Date; until: Date }) {
  return videos.metrics(window);
}

async function withUrls(row: Row): Promise<Video> {
  return {
    id: row.id,
    prompt: row.prompt,
    duration: row.duration,
    resolution: row.resolution,
    credits: row.credits,
    status: row.status,
    createdAt: row.createdAt,
    url: row.status === "succeeded" && row.storageKey ? await signedUrl(row.storageKey) : null,
    imageUrl: row.imageKey ? await signedUrl(row.imageKey) : null,
  };
}

function isDuration(value: number): value is VideoDuration {
  return (VIDEO_DURATIONS as readonly number[]).includes(value);
}

// Detects the type from the file's first bytes, not the name the browser sent.
// Before anything is stored or spent: a provider would fail the job anyway.
function assertImageSize(bytes: Uint8Array, limits: ImageLimits) {
  const size = imageSize(bytes);
  if (!size) throw new InvalidVideoRequestError("The image's size can't be read");
  if (!checkImageSize(size, limits)) throw new InvalidImageSizeError(limits);
}

function imageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

// Deletes the user's stored MP4s and start images. Their rows go with the user.
export function deleteUserVideos(userId: string): Promise<void> {
  return videos.deleteUserFiles(userId);
}
