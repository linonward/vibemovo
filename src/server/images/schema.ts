import { sql } from "drizzle-orm";
import { index, pgTable, text } from "drizzle-orm/pg-core";
import { generationColumns } from "@/server/generations/columns";
import { IMAGE_ASPECTS } from "./config";

// One row per generation. The PNG lives in object storage under storageKey.
export const image = pgTable(
  "image",
  {
    ...generationColumns(),
    prompt: text("prompt").notNull(),
    aspect: text("aspect", { enum: IMAGE_ASPECTS }).notNull(),
    // Bailian's task ID, set once the image is submitted.
    taskId: text("task_id"),
  },
  (table) => [
    index("image_userId_createdAt_idx").on(table.userId, table.createdAt),
    // The sweep reads only pending rows, by age.
    index("image_pending_createdAt_idx").on(table.createdAt).where(sql`${table.status} = 'pending'`),
  ],
);
