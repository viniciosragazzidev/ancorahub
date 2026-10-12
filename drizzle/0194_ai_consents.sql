-- Consentimento de IA (LGPD): cada decisão do usuário vira uma linha (histórico para auditoria).
-- Vale a mais recente por (tenant, usuário, escopo). Só cria tabela e índice: não trava nada existente.
CREATE TABLE IF NOT EXISTS "ai_consents" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scope" text NOT NULL,
  "terms_version" text NOT NULL,
  "decision" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "ai_consents_scope_check" CHECK ("scope" IN ('broker_assistants')),
  CONSTRAINT "ai_consents_decision_check" CHECK ("decision" IN ('granted','declined','revoked'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_consents_tenant_user_scope_created_idx" ON "ai_consents" ("tenant_id","user_id","scope","created_at");
