CREATE TABLE "video" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"duration" integer NOT NULL,
	"provider" text NOT NULL,
	"resolution" text NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"request_id" text,
	"image_key" text,
	"storage_key" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_userId_createdAt_idx" ON "video" USING btree ("user_id","created_at");