import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { dashscopeConfigured, ImageGenerationError, imageResult, submitImage } from "@/server/ai/dashscope";
import { getDb } from "@/server/db";
import { lifecycle } from "@/server/generations";
import { checkPrompt, ContentBlockedError } from "@/server/moderation";
import { signedUrl, storageConfigured } from "@/server/storage";
import {
  IMAGE_ASPECTS,
  IMAGE_GIVE_UP_AFTER_MS,
  IMAGES_PAGE_SIZE,
  IMAGE_SIZES,
  IMAGE_STALE_AFTER_MS,
  IMAGE_SWEEP_BATCH,
  type ImageAspect,
  imageCost,
  MAX_PROMPT_LENGTH,
} from "./config";
import { image } from "./schema";

export class ImagesDisabledError extends Error {
  constructor() {
    super("Image generation is off: set DASHSCOPE_API_KEY and the STORAGE_* variables");
  }
}

export class InvalidImageRequestError extends Error {}

export { ContentBlockedError };

const BLOCKED_CODES = new Set(["DataInspectionFailed", "IPInfringementSuspect"]);

export type Image = {
  id: string;
  prompt: string;
  aspect: ImageAspect;
  status: "pending" | "succeeded" | "failed";
  createdAt: Date;
  // A signed URL, valid for an hour. Null unless the image is stored.
  url: string | null;
};

type Row = typeof image.$inferSelect;

const images = lifecycle({
  name: "image",
  table: image,
  jobColumn: image.taskId,
  jobId: (row) => row.taskId,
  credits: () => imageCost,
  poll: (_row, taskId) => imageResult(taskId),
  output: { ext: "png", mime: "image/png", timeoutMs: 60_000, error: (message) => new ImageGenerationError(message) },
  notification: {
    succeeded: (row) => ({ type: "image_succeeded", data: { imageId: row.id, prompt: row.prompt } }),
    failed: (row, credits) => ({ type: "image_failed", data: { imageId: row.id, prompt: row.prompt, credits } }),
  },
  neverFinished: "Bailian never finished",
  stale: { afterMs: IMAGE_STALE_AFTER_MS, giveUpAfterMs: IMAGE_GIVE_UP_AFTER_MS, batch: IMAGE_SWEEP_BATCH },
});

export function imagesEnabled() {
  return dashscopeConfigured() && storageConfigured();
}

// Spends the cost and queues one image with Bailian. The image finishes
// seconds later; refreshImage collects it. A failure to queue refunds the
// cost, with an idempotency key per image so it refunds once.
export async function createImage(input: {
  userId: string;
  prompt: string;
  aspect: string;
}): Promise<Image> {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    throw new InvalidImageRequestError(`Prompt must be 1-${MAX_PROMPT_LENGTH} characters`);
  }
  if (!isAspect(input.aspect)) throw new InvalidImageRequestError(`Unknown aspect: ${input.aspect}`);
  if (!imagesEnabled()) throw new ImagesDisabledError();
  checkPrompt(prompt);

  const { userId, aspect } = input;
  const id = randomUUID();
  const db = getDb();
  try {
    const row = await images.start(
      { userId, id, credits: imageCost },
      (tx) => tx.insert(image).values({ id, userId, prompt, aspect }),
      async () => {
        const taskId = await submitImage({ prompt, size: IMAGE_SIZES[aspect] });
        const [submitted] = await db.update(image).set({ taskId }).where(eq(image.id, id)).returning();
        return submitted;
      },
    );
    return withUrl(row);
  } catch (error) {
    if (error instanceof ImageGenerationError && error.code && BLOCKED_CODES.has(error.code)) {
      throw new ContentBlockedError(error.message, { cause: error });
    }
    throw error;
  }
}

// Returns the user's image, first asking Bailian about a pending one. A
// finished image is copied to storage, because Bailian deletes it after 24
// hours; a failed one is refunded. Null if not found. Throws if Bailian or
// storage fails, leaving the image pending for a retry.
export async function refreshImage(userId: string, id: string): Promise<Image | null> {
  const row = await images.refresh(userId, id);
  return row ? withUrl(row) : null;
}

// Returns the user's image as stored, without asking Bailian. Null if not found.
export async function getImage(userId: string, id: string): Promise<Image | null> {
  const row = await images.get(userId, id);
  return row ? withUrl(row) : null;
}

// A signed URL that downloads the user's stored image as a file. Null if
// not found or not stored.
export async function imageDownloadUrl(userId: string, id: string): Promise<string | null> {
  const key = await images.storedKey(userId, id);
  return key ? signedUrl(key, { download: `image-${id}.png` }) : null;
}

// Settles images left pending: fails and refunds those never submitted (a
// crash) or that Bailian forgot, and collects finished ones nobody polled
// for. Returns how many it failed and checked.
export function sweepStaleImages(now = new Date()): Promise<{ failed: number; checked: number }> {
  return images.sweep(now);
}

// Finished images only.
export function countImages(userId: string): Promise<number> {
  return images.count(userId);
}

export async function listImages(userId: string, limit = 24): Promise<Image[]> {
  return Promise.all((await images.list(userId, limit)).map(withUrl));
}

// One page of the user's images, newest first. `total` counts them all, so
// the page can link to the rest.
export async function pageImages(
  userId: string,
  page = 1,
  pageSize = IMAGES_PAGE_SIZE,
): Promise<{ images: Image[]; total: number }> {
  const { rows, total } = await images.page(userId, page, pageSize);
  return { images: await Promise.all(rows.map(withUrl)), total };
}

// How images created between `since` and `until` went, for /admin/metrics.
export function imageMetrics(window: { since: Date; until: Date }) {
  return images.metrics(window);
}

function isAspect(value: string): value is ImageAspect {
  return (IMAGE_ASPECTS as readonly string[]).includes(value);
}

async function withUrl(row: Row): Promise<Image> {
  return {
    id: row.id,
    prompt: row.prompt,
    aspect: row.aspect,
    status: row.status,
    createdAt: row.createdAt,
    url: row.status === "succeeded" && row.storageKey ? await signedUrl(row.storageKey) : null,
  };
}

// Deletes the user's stored PNGs. Their rows go with the user.
export function deleteUserImages(userId: string): Promise<void> {
  return images.deleteUserFiles(userId);
}
