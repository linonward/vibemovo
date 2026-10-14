import { eq } from "drizzle-orm";
import { apikey } from "@/server/auth/schema";
import { getDb } from "@/server/db";
import { deleteUserFeedbackImages } from "@/server/feedback";
import { deleteUserImages } from "@/server/images";
import { log } from "@/server/log";
import { assertNoLiveSubscription, LiveSubscriptionError } from "@/server/payment/subscriptions";
import { deleteUserVideos } from "@/server/videos";

export { LiveSubscriptionError };

// Account deletion, across the modules that hold a user's data. Rows
// cascade with the user; these cover what the database can't.

// Throws LiveSubscriptionError while the user has a live subscription: the
// provider would keep charging after the account is gone.
export async function beforeDeleteUser(userId: string): Promise<void> {
  await assertNoLiveSubscription(userId);
}

// Deletes the user's API keys and stored files. API keys name their owner
// without a foreign key, so they don't cascade. The account is already gone,
// so a storage failure can't undo it: it's logged for an operator to delete
// the files by hand.
export async function afterDeleteUser(userId: string): Promise<void> {
  await getDb().delete(apikey).where(eq(apikey.referenceId, userId));
  try {
    await Promise.all([deleteUserImages(userId), deleteUserVideos(userId), deleteUserFeedbackImages(userId)]);
  } catch (error) {
    log.error("storage.user_files_not_deleted", { userId, error });
  }
}
