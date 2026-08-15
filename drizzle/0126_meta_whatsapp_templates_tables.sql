CREATE TABLE IF NOT EXISTS "meta_whatsapp_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "waba_id" text NOT NULL,
  "meta_template_id" text,
  "name" text NOT NULL,
  "language" text NOT NULL DEFAULT 'pt_BR',
  "category" text NOT NULL DEFAULT 'UTILITY',
  "status" text NOT NULL DEFAULT 'PENDING',
  "quality_rating" text,
  "components_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "header_type" text NOT NULL DEFAULT 'NONE',
  "body_text" text,
  "footer_text" text,
  "variables_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "buttons_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "origin" text NOT NULL DEFAULT 'CRM',
  "rejected_reason" text,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "meta_whatsapp_templates_tenant_waba_idx" ON "meta_whatsapp_templates" ("tenant_id", "waba_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_templates_tenant_name_lang_unique" ON "meta_whatsapp_templates" ("tenant_id", "waba_id", "name", "language");

CREATE TABLE IF NOT EXISTS "meta_whatsapp_template_usages" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "event_key" text NOT NULL,
  "template_id" text NOT NULL REFERENCES "meta_whatsapp_templates"("id") ON DELETE cascade,
  "variable_mappings_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_whatsapp_template_usages_tenant_event_unique" ON "meta_whatsapp_template_usages" ("tenant_id", "event_key");
CREATE INDEX IF NOT EXISTS "meta_whatsapp_template_usages_tenant_active_idx" ON "meta_whatsapp_template_usages" ("tenant_id", "active");
