import { sql } from "drizzle-orm";
import { index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { VIDEO_PROVIDER_IDS } from "@/server/ai/video/types";
import { generationColumns } from "@/server/generations/columns";

// One row per generation. The start image and the MP4 live in object
// storage; a two-photo video (rap duo, zombie couple, younger-self hug,
// raindance duo)
// also stores its second photo as <id>-2.<ext>.
export const video = pgTable(
  "video",
  {
    ...generationColumns(),
    prompt: text("prompt").notNull(),
    // Seconds: one of VIDEO_DURATIONS, RAP_DURATION for a two-photo video,
    // or VAMPIRE_DURATION for a vampire transformation.
    duration: integer("duration").notNull(),
    // The provider that took the job; it alone can finish it.
    provider: text("provider", { enum: VIDEO_PROVIDER_IDS }).notNull(),
    // One of the provider's resolutions in VIDEO_RESOLUTIONS.
    resolution: text("resolution").notNull(),
    // Credits spent, and refunded if generation fails.
    credits: integer("credits").notNull(),
    // The provider's request ID, set once the job is submitted.
    requestId: text("request_id"),
    imageKey: text("image_key"),
    // Where the poster frame is cut, in milliseconds, for videos whose first
    // photo makes a poor poster. Null keeps the first photo.
    posterMs: integer("poster_ms"),
    // The poster frame, `<id>-poster.jpg`, cut once the MP4 is stored. Kept
    // after the uploads expire.
    posterKey: text("poster_key"),
  },
  (table) => [
    index("video_userId_createdAt_idx").on(table.userId, table.createdAt),
    // The sweep reads only pending rows, by age.
    index("video_pending_createdAt_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
    // expireUploads reads only rows that still have an upload, by age.
    index("video_upload_createdAt_idx").on(table.createdAt).where(sql`${table.imageKey} is not null`),
  ],
);
