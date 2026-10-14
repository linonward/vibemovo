import { createHash, timingSafeEqual } from "node:crypto";
import { sweepStaleImages } from "@/server/images";
import { log } from "@/server/log";
import { grantYearlyMonths } from "@/server/payment/subscriptions";
import { expireUploads, sweepStaleVideos } from "@/server/videos";

const digest = (value: string) => createHash("sha256").update(value).digest();

// True when the request carries "Authorization: Bearer <CRON_SECRET>".
// Always false while the secret is unset, so the jobs stay closed.
export function isCronRequest(headers: Headers, secret = process.env.CRON_SECRET): boolean {
  if (!secret) return false;
  const given = headers.get("authorization") ?? "";
  // Compare digests, which have equal length, in constant time.
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}

// Settles generations left pending by crashes or closed pages, grants
// yearly plans the months that have begun and deletes uploads past their
// retention. Safe to run at any interval and concurrently: every refund and
// grant has an idempotency key, and a deleted upload is cleared once.
// Each task runs even if another fails. Wait for all of them before throwing,
// so the scheduler sees a failure without cutting off the other tasks.
export async function sweepPending() {
  const [images, videos, subscriptionMonths, uploads] = await Promise.allSettled([
    sweepStaleImages(),
    sweepStaleVideos(),
    grantYearlyMonths(),
    expireUploads(),
  ]);
  const settled = { images, videos, subscriptionMonths, uploads };
  const errors: unknown[] = [];
  for (const [task, result] of Object.entries(settled)) {
    if (result.status === "rejected") {
      log.error("cron.task_failed", { task, error: result.reason });
      errors.push(result.reason);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, "Pending sweep failed");
  // Every task succeeded.
  const value = <T>(result: PromiseSettledResult<T>) => (result as PromiseFulfilledResult<T>).value;
  return {
    images: value(images),
    videos: value(videos),
    subscriptionMonths: value(subscriptionMonths),
    uploads: value(uploads),
  };
}
