ALTER TABLE "order" ALTER COLUMN "provider_session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "provider_session_id" DROP NOT NULL;