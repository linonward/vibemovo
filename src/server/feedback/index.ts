import { randomUUID } from "node:crypto";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { user } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { log } from "@/server/log";
import { deleteObject, deletePrefix, putObject, signedUrl, storageConfigured } from "@/server/storage";
import { FEEDBACK_PAGE_SIZE, MAX_FEEDBACK_LENGTH } from "./config";
import { feedbackImageType, validImageSizes } from "./images";
import { feedback } from "./schema";

const inputSchema = z.object({
  message: z.string().trim().max(MAX_FEEDBACK_LENGTH),
  requestId: z.uuid(),
});

export class InvalidFeedbackError extends Error {
  constructor() {
    super("Invalid feedback");
    this.name = "InvalidFeedbackError";
  }
}

export class FeedbackStorageDisabledError extends Error {}

// Serialize retries before uploading. Each attempt gets unique object keys,
// so cleanup can never delete another request's saved attachments.
export async function submitFeedback(userId: string, input: unknown, images: Uint8Array[] = []) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || (!parsed.data.message && images.length === 0) || !validImageSizes(images.map((image) => image.byteLength))) {
    throw new InvalidFeedbackError();
  }
  const files = images.map((bytes) => {
    const type = feedbackImageType(bytes);
    if (!type) throw new InvalidFeedbackError();
    return { bytes, ...type };
  });
  const attempted: string[] = [];
  try {
    return await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`feedback:${userId}:${parsed.data.requestId}`}, 0))`);
      const [existing] = await tx.select().from(feedback)
        .where(and(eq(feedback.userId, userId), eq(feedback.requestId, parsed.data.requestId)));
      if (existing) return existing;
      if (files.length && !storageConfigured()) throw new FeedbackStorageDisabledError();
      const id = randomUUID();
      const attachments: { key: string; mime: string }[] = [];
      for (const [index, file] of files.entries()) {
        const key = `feedback/${userId}/${id}/${index}.${file.ext}`;
        attempted.push(key);
        await putObject(key, file.bytes, file.mime);
        attachments.push({ key, mime: file.mime });
      }
      const [created] = await tx.insert(feedback).values({ id, userId, ...parsed.data, images: attachments }).returning();
      return created;
    });
  } catch (error) {
    const cleanup = await Promise.allSettled(attempted.map((key) => deleteObject(key)));
    cleanup.forEach((result, index) => {
      if (result.status === "rejected") log.error("feedback.cleanup_failed", { key: attempted[index], error: result.reason });
    });
    throw error;
  }
}

export async function feedbackImageUrl(id: string, index: number) {
  if (!Number.isSafeInteger(index) || index < 0) return null;
  const [row] = await getDb().select({ images: feedback.images }).from(feedback).where(eq(feedback.id, id));
  const image = row?.images[index];
  return image ? signedUrl(image.key) : null;
}

export async function deleteUserFeedbackImages(userId: string) {
  if (storageConfigured()) await deletePrefix(`feedback/${userId}/`);
}

// Call only after the admin access check. Email comes from the account.
export async function listFeedback({ page = 1, pageSize = FEEDBACK_PAGE_SIZE }: { page?: number; pageSize?: number } = {}) {
  const db = getDb();
  const [items, [{ total }]] = await Promise.all([
    db.select({ id: feedback.id, message: feedback.message, createdAt: feedback.createdAt, images: feedback.images, name: user.name, email: user.email })
      .from(feedback).innerJoin(user, eq(user.id, feedback.userId))
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(pageSize).offset((Math.max(1, page) - 1) * pageSize),
    db.select({ total: count() }).from(feedback),
  ]);
  return { items: items.map(({ images, ...item }) => ({ ...item, imageCount: images.length })), total };
}
