import { withSession } from "@/app/api/_lib/with-session";
import { apiError } from "@/lib/api";
import { isAdmin } from "@/server/admin/access";
import { feedbackImageUrl } from "@/server/feedback";

export const GET = withSession<{ id: string; index: string }>(async (_request, { session, params }) => {
  if (!isAdmin(session.user.email)) return apiError("NOT_FOUND", 404);
  if (!/^\d+$/.test(params.index)) return apiError("NOT_FOUND", 404);
  const url = await feedbackImageUrl(params.id, Number(params.index));
  if (!url) return apiError("NOT_FOUND", 404);
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, no-store" } });
});
