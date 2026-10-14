import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type ImageResponse } from "@/lib/api";
import { InsufficientCreditsError } from "@/server/credits";
import {
  ContentBlockedError,
  createImage,
  ImagesDisabledError,
  InvalidImageRequestError,
} from "@/server/images";
import { log } from "@/server/log";

// Queues one image. Body: { prompt, aspect }. Returns { image }, pending
// until GET /api/images/<id> collects it.
export const POST = withSession(async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const aspect = typeof body.aspect === "string" ? body.aspect : "";

  try {
    const image = await createImage({ userId: session.user.id, prompt, aspect });
    return Response.json({ image } satisfies ImageResponse);
  } catch (error) {
    if (error instanceof InvalidImageRequestError) {
      return apiError("INVALID_REQUEST", 400);
    }
    if (error instanceof InsufficientCreditsError) {
      return apiError("INSUFFICIENT_CREDITS", 402);
    }
    if (error instanceof ContentBlockedError) {
      log.info("image.blocked", { userId: session.user.id, reason: error.message });
      return apiError("CONTENT_BLOCKED", 422);
    }
    if (error instanceof ImagesDisabledError) {
      return apiError("IMAGES_DISABLED", 503);
    }
    log.error("image.submit_failed", { userId: session.user.id, error });
    return apiError("GENERATION_FAILED", 502);
  }
}, { apiKey: true });
