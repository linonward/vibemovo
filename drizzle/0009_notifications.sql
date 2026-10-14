CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"key" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_userId_createdAt_idx" ON "notification" USING btree ("user_id","created_at");