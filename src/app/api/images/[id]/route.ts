import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type ImageResponse } from "@/lib/api";
import { refreshImage } from "@/server/images";
import { log } from "@/server/log";

type Params = Awaited<RouteContext<"/api/images/[id]">["params"]>;

// Copying a finished PNG to storage can take a while.
export const maxDuration = 120;

// Returns { image }, after asking Bailian about it if it's still pending.
export const GET = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  try {
    const image = await refreshImage(session.user.id, id);
    if (!image) return apiError("IMAGE_NOT_FOUND", 404);
    return Response.json({ image } satisfies ImageResponse);
  } catch (error) {
    // The image stays pending; the next poll tries again.
    log.error("image.refresh_failed", { id, error });
    return apiError("REFRESH_FAILED", 502);
  }
}, { limit: LIMITS.imagePoll, apiKey: true });
