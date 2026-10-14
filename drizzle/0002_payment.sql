CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "order_provider_session_unique" UNIQUE("provider","provider_session_id")
);
--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_userId_idx" ON "order" USING btree ("user_id");