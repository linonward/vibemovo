CREATE TABLE "credit_balance" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_balance_non_negative" CHECK ("credit_balance"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transaction_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "credit_transaction_amount_nonzero" CHECK ("credit_transaction"."amount" <> 0)
);
--> statement-breakpoint
ALTER TABLE "credit_balance" ADD CONSTRAINT "credit_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_transaction_userId_idx" ON "credit_transaction" USING btree ("user_id");