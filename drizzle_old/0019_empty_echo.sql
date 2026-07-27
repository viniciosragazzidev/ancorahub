ALTER TABLE "whatsapp_connections" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_connections_user_idx" ON "whatsapp_connections" USING btree ("user_id");