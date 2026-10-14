import { connection } from "next/server";
import { apiError } from "@/lib/api";

// The IndexNow key (src/server/indexnow), which search engines fetch to
// check that this site sent the URLs. 404 while INDEXNOW_KEY is unset.
export async function GET() {
  // Read INDEXNOW_KEY per request, so a build doesn't bake it in.
  await connection();
  const key = process.env.INDEXNOW_KEY;
  if (!key) return apiError("NOT_FOUND", 404);
  return new Response(key, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
