DROP INDEX "credit_transaction_userId_idx";--> statement-breakpoint
ALTER TABLE "image" ADD COLUMN "checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "video" ADD COLUMN "checked_at" timestamp;--> statement-breakpoint
CREATE INDEX "credit_transaction_userId_createdAt_idx" ON "credit_transaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "image_pending_createdAt_idx" ON "image" USING btree ("created_at") WHERE "image"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "video_pending_createdAt_idx" ON "video" USING btree ("created_at") WHERE "video"."status" = 'pending';