CREATE TABLE "chat" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"chat_id" text NOT NULL,
	"id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "chat_message_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_pk" PRIMARY KEY("chat_id","id")
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_userId_updatedAt_idx" ON "chat" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_message_chatId_seq_idx" ON "chat_message" USING btree ("chat_id","seq");