import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError } from "@/lib/api";
import { videoDownloadUrl } from "@/server/videos";

type Params = Awaited<RouteContext<"/api/videos/[id]/download">["params"]>;

// Redirects to a signed URL that saves the stored MP4 as a file, so a plain
// link downloads it without leaving the page.
export const GET = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  const url = await videoDownloadUrl(session.user.id, id);
  if (!url) return apiError("VIDEO_NOT_FOUND", 404);
  return Response.redirect(url, 302);
}, { limit: LIMITS.download, apiKey: true });
