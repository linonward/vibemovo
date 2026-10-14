import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError, type VideoResponse } from "@/lib/api";
import { log } from "@/server/log";
import { refreshVideo } from "@/server/videos";

type Params = Awaited<RouteContext<"/api/videos/[id]">["params"]>;

// Copying a finished MP4 to storage can take a while.
export const maxDuration = 120;

// Returns { video }, after asking its provider about it if it's still pending.
export const GET = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  try {
    const video = await refreshVideo(session.user.id, id);
    if (!video) return apiError("VIDEO_NOT_FOUND", 404);
    return Response.json({ video } satisfies VideoResponse);
  } catch (error) {
    // The video stays pending; the next poll tries again.
    log.error("video.refresh_failed", { id, error });
    return apiError("REFRESH_FAILED", 502);
  }
}, { limit: LIMITS.videoPoll, apiKey: true });
