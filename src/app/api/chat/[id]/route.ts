import { withSession } from "@/app/api/_lib/with-session";
import { apiError } from "@/lib/api";
import { deleteChat } from "@/server/ai/chats";

type Params = Awaited<RouteContext<"/api/chat/[id]">["params"]>;

// Deletes one of the user's chats and its messages.
export const DELETE = withSession<Params>(async (_request, { session, params }) => {
  const { id } = params;
  if (!(await deleteChat(session.user.id, id))) {
    return apiError("CHAT_NOT_FOUND", 404);
  }
  return new Response(null, { status: 204 });
});
