import { apiError } from "@/lib/api";
import { isCronRequest, sweepPending } from "@/server/cron";
import { log } from "@/server/log";

// Collecting finished videos copies each MP4 to storage.
export const maxDuration = 300;

// Settles images and videos left pending and grants yearly plans their
// monthly credits (sweepPending). A scheduler calls this every few
// minutes with "Authorization: Bearer <CRON_SECRET>". Returns the counts.
// GET is for Vercel Cron (vercel.json), which sends GET with that header;
// POST is for any other scheduler.
async function sweep(request: Request) {
  // Same answer whether the secret is wrong or unset: the route isn't there.
  if (!isCronRequest(request.headers)) return apiError("NOT_FOUND", 404);

  const result = await sweepPending();
  log.info("cron.sweep", result);
  return Response.json(result);
}

export { sweep as GET, sweep as POST };
