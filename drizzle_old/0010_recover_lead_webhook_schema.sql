-- Custom SQL migration file, put your code below! --
DO $$ BEGIN
  CREATE TYPE "public"."webhook_credential_status" AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."webhook_delivery_status" AS ENUM ('received', 'processed', 'rejected', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "webhook_credential_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_webhook_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "name" text NOT NULL,
  "token_prefix" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "status" "webhook_credential_status" DEFAULT 'active' NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id"),
  "credential_id" text NOT NULL REFERENCES "lead_webhook_credentials"("id"),
  "request_id" text NOT NULL,
  "idempotency_key" text,
  "external_id" text,
  "payload_hash" text NOT NULL,
  "status" "webhook_delivery_status" DEFAULT 'received' NOT NULL,
  "lead_id" text REFERENCES "leads"("id"),
  "error_code" text,
  "received_at" timestamp with time zone NOT NULL,
  "processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "branches_tenant_id_idx" ON "branches" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branches_tenant_external_id_unique" ON "branches" USING btree ("tenant_id", "external_id") WHERE "branches"."external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_webhook_credential_idx" ON "leads" USING btree ("webhook_credential_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_credential_external_id_unique" ON "leads" USING btree ("webhook_credential_id", "external_id") WHERE "leads"."external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_webhook_credentials_tenant_id_idx" ON "lead_webhook_credentials" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_webhook_credentials_created_by_idx" ON "lead_webhook_credentials" USING btree ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenant_id_idx" ON "webhook_deliveries" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_credential_id_idx" ON "webhook_deliveries" USING btree ("credential_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_deliveries_credential_idempotency_unique" ON "webhook_deliveries" USING btree ("credential_id", "idempotency_key") WHERE "webhook_deliveries"."idempotency_key" IS NOT NULL;
