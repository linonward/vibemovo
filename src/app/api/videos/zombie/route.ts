import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type VideoResponse } from "@/lib/api";
import { InsufficientCreditsError } from "@/server/credits";
import { log } from "@/server/log";
import {
  ContentBlockedError,
  createZombieVideo,
  InvalidImageSizeError,
  InvalidVideoRequestError,
  ModerationUnavailableError,
  VideosDisabledError,
} from "@/server/videos";

// Queues one zombie couple video. Multipart body: image1 (left) and image2
// (right). Returns { video } with status "pending"; poll GET
// /api/videos/<id> until it finishes.
export const POST = withSession(async (request, { session }) => {
  const form = await request.formData().catch(() => null);
  const [image1, image2] = ["image1", "image2"].map((key) => form?.get(key));
  if (!(image1 instanceof File) || !(image2 instanceof File)) {
    return apiError("INVALID_REQUEST", 400);
  }

  try {
    const video = await createZombieVideo({
      userId: session.user.id,
      images: [new Uint8Array(await image1.arrayBuffer()), new Uint8Array(await image2.arrayBuffer())],
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
