import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type VideoResponse } from "@/lib/api";
import { InsufficientCreditsError } from "@/server/credits";
import { log } from "@/server/log";
import {
  ContentBlockedError,
  createVampireVideo,
  InvalidImageSizeError,
  InvalidVideoRequestError,
  ModerationUnavailableError,
  VideosDisabledError,
} from "@/server/videos";

// Queues one vampire transformation video. Multipart body: image1. Returns
// { video } with status "pending"; poll GET /api/videos/<id> until it finishes.
export const POST = withSession(async (request, { session }) => {
  const image = (await request.formData().catch(() => null))?.get("image1");
  if (!(image instanceof File)) {
    return apiError("INVALID_REQUEST", 400);
  }

  try {
    const video = await createVampireVideo({
      userId: session.user.id,
      image: new Uint8Array(await image.arrayBuffer()),
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
