import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type VideoResponse } from "@/lib/api";
import { InsufficientCreditsError } from "@/server/credits";
import { log } from "@/server/log";
import {
  ContentBlockedError,
  createRapVideo,
  InvalidImageSizeError,
  InvalidVideoRequestError,
  ModerationUnavailableError,
  VideosDisabledError,
} from "@/server/videos";

// Queues one rap duo video. Multipart body: name1, name2, image1 (left),
// image2 (right) and language ("en" or "zh", for the lines). Returns
// { video } with status "pending"; poll GET /api/videos/<id> until it finishes.
export const POST = withSession(async (request, { session }) => {
  const form = await request.formData().catch(() => null);
  const [name1, name2, image1, image2] = ["name1", "name2", "image1", "image2"].map((key) => form?.get(key));
  if (
    typeof name1 !== "string" ||
    typeof name2 !== "string" ||
    !(image1 instanceof File) ||
    !(image2 instanceof File)
  ) {
    return apiError("INVALID_REQUEST", 400);
  }

  try {
    const video = await createRapVideo({
      userId: session.user.id,
      names: [name1, name2],
      images: [new Uint8Array(await image1.arrayBuffer()), new Uint8Array(await image2.arrayBuffer())],
      language: form?.get("language") === "zh" ? "zh" : "en",
    });
    return Response.json({ video } satisfies VideoResponse);
  } catch (error) {
    if (error instanceof InvalidImageSizeError) {
      return apiError("INVALID_IMAGE_SIZE", 400);
    }
    if (error instanceof InvalidVideoRequestError) {
      return apiError("INVALID_REQUEST", 400);
    }
    if (error instanceof InsufficientCreditsError) {
      return apiError("INSUFFICIENT_CREDITS", 402);
    }
    if (error instanceof ContentBlockedError) {
      log.info("video.blocked", { userId: session.user.id, reason: error.message });
      return apiError("CONTENT_BLOCKED", 422);
    }
    if (error instanceof ModerationUnavailableError) {
      log.error("video.moderation_failed", { userId: session.user.id, error });
      return apiError("MODERATION_UNAVAILABLE", 503);
    }
    if (error instanceof VideosDisabledError) {
      return apiError("VIDEOS_DISABLED", 503);
    }
    log.error("video.submit_failed", { userId: session.user.id, error });
    return apiError("GENERATION_FAILED", 502);
  }
});
