CREATE TABLE IF NOT EXISTS "waha_group_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "waha_number_id" text NOT NULL REFERENCES "waha_numbers"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL,
  "group_name" text,
  "active" boolean DEFAULT false NOT NULL,
  "last_listed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waha_group_sources_unique" ON "waha_group_sources" ("tenant_id", "waha_number_id", "group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waha_group_sources_number_group_idx" ON "waha_group_sources" ("waha_number_id", "group_id");
