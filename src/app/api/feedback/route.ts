import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type FeedbackResponse } from "@/lib/api";
import { FeedbackStorageDisabledError, InvalidFeedbackError, submitFeedback } from "@/server/feedback";
import { validImageSizes } from "@/server/feedback/images";
import { log } from "@/server/log";

export const POST = withSession(async (request, { session }) => {
  let body: unknown;
  let images: Uint8Array[] = [];
  if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return apiError("INVALID_REQUEST", 400);
    const files = form.getAll("images");
    if (!files.every((file): file is File => file instanceof File) || !validImageSizes(files.map((file) => file.size))) {
      return apiError("INVALID_REQUEST", 400);
    }
    body = { message: form.get("message"), requestId: form.get("requestId") };
    images = await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())));
  } else {
    body = await request.json().catch(() => null);
  }
  try {
    const saved = await submitFeedback(session.user.id, body, images);
    return Response.json({ feedback: { id: saved.id } } satisfies FeedbackResponse);
  } catch (error) {
    if (error instanceof InvalidFeedbackError) return apiError("INVALID_REQUEST", 400);
    if (error instanceof FeedbackStorageDisabledError) return apiError("FEEDBACK_STORAGE_DISABLED", 503);
    log.error("feedback.submit_failed", { userId: session.user.id, error });
    return apiError("FEEDBACK_FAILED", 502);
  }
}, { limit: LIMITS.feedback });
