CREATE TABLE "workflow_automations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" "automation_status" NOT NULL DEFAULT 'rascunho',
  "draft_definition" jsonb NOT NULL DEFAULT '{"schemaVersion":1,"nodes":[],"edges":[]}'::jsonb,
  "published_version_id" text,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "workflow_automation_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workflow_id" text NOT NULL REFERENCES "workflow_automations"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "definition" jsonb NOT NULL,
  "published_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "workflow_automation_versions_workflow_version_unique" UNIQUE ("workflow_id", "version")
);

CREATE INDEX "workflow_automations_tenant_status_idx" ON "workflow_automations" ("tenant_id", "status");
CREATE INDEX "workflow_automations_tenant_updated_idx" ON "workflow_automations" ("tenant_id", "updated_at");
CREATE INDEX "workflow_automation_versions_tenant_workflow_idx" ON "workflow_automation_versions" ("tenant_id", "workflow_id");

INSERT INTO "system_settings" ("key", "value") VALUES
  ('feature_workflow_automation_enabled', 'false'),
  ('feature_workflow_ai_nodes_enabled', 'false'),
  ('feature_workflow_whatsapp_nodes_enabled', 'false')
ON CONFLICT ("key") DO NOTHING;
