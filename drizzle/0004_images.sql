CREATE TABLE "image" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"aspect" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "image" ADD CONSTRAINT "image_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_userId_createdAt_idx" ON "image" USING btree ("user_id","created_at");