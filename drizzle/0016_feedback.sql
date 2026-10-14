CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_userId_requestId_idx" ON "feedback" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE INDEX "feedback_createdAt_id_idx" ON "feedback" USING btree ("created_at","id");