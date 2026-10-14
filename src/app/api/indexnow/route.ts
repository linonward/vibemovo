import sitemap from "@/app/sitemap";
import { apiError } from "@/lib/api";
import { isCronRequest } from "@/server/cron";
import { submitUrls } from "@/server/indexnow";
import { log } from "@/server/log";

// Sends every sitemap URL to IndexNow. Call it after a deploy with
// "Authorization: Bearer <CRON_SECRET>". Answers the count submitted and
// the engines' status: 200 when they accept, 502 when they refuse.
export async function POST(request: Request) {
  // Same answer whether the secret is wrong, unset or the key is missing:
  // the route isn't there.
  if (!isCronRequest(request.headers) || !process.env.INDEXNOW_KEY) return apiError("NOT_FOUND", 404);

  const urls = (await sitemap()).map((entry) => entry.url);
  const result = await submitUrls(urls);
  const accepted = result.status === 200 || result.status === 202;
  if (accepted) log.info("indexnow.submitted", result);
  else log.warn("indexnow.refused", result);
  return Response.json(result, { status: accepted ? 200 : 502 });
}
