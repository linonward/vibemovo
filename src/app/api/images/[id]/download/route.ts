import { LIMITS } from "@/app/api/_lib/limits";
import { withSession } from "@/app/api/_lib/with-session";
import { apiError } from "@/lib/api";
import { imageDownloadUrl } from "@/server/images";

type Params = Awaited<RouteContext<"/api/images/[id]/download">["params"]>;

// Redirects to a signed URL that saves the stored PNG as a file, so a plain
// link downloads it without leaving the page.
export const GET = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  const url = await imageDownloadUrl(session.user.id, id);
  if (!url) return apiError("IMAGE_NOT_FOUND", 404);
  return Response.redirect(url, 302);
}, { limit: LIMITS.download, apiKey: true });
