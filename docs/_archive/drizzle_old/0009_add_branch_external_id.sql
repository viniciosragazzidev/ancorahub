-- Custom SQL migration file, put your code below! --
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "branches_tenant_external_id_unique" ON "branches" USING btree ("tenant_id", "external_id") WHERE "branches"."external_id" IS NOT NULL;
