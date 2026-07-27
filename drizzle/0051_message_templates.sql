-- Templates de mensagens rapidas para WhatsApp/e-mail.
-- Permite gerenciar mensagens padronizadas por tenant.
CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "category" text NOT NULL DEFAULT 'geral',
  "content" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]',
  "active" boolean NOT NULL DEFAULT true,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "message_templates_tenant_idx" ON "message_templates" ("tenant_id", "active");
