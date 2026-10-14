CREATE TABLE "broadcast" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"email" text,
	"sent_by" text NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "broadcast_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE INDEX "broadcast_createdAt_idx" ON "broadcast" USING btree ("created_at");