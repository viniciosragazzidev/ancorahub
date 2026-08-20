ALTER TABLE "whatsapp_connections" ADD COLUMN "id" text;
--> statement-breakpoint
UPDATE "whatsapp_connections" SET "id" = md5(random()::text || clock_timestamp()::text) WHERE "id" IS NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ALTER COLUMN "id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" DROP CONSTRAINT "whatsapp_connections_pkey";
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id");
--> statement-breakpoint
CREATE INDEX "whatsapp_connections_session_idx" ON "whatsapp_connections" USING btree ("session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_tenant_user_unique" ON "whatsapp_connections" USING btree ("tenant_id", "user_id") WHERE "user_id" IS NOT NULL;
