CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"provider_session_id" text NOT NULL,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_provider_session_unique" UNIQUE("provider","provider_session_id")
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_userId_idx" ON "subscription" USING btree ("user_id");