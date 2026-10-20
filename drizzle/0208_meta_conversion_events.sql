-- API de Conversões para CRM (Conversion Leads), decidido pelo diretor em
-- 2026-10-20: as etapas dos leads de Lead Ads voltam para a Meta otimizar as
-- campanhas por "leads de conversão". Duas tabelas novas, nenhuma coluna em
-- tabela existente: até este SQL ser aplicado, só o recurso novo fica
-- indisponível (o fluxo do lead ignora a falha).

-- Configuração por empresa. Começa desligada.
CREATE TABLE IF NOT EXISTS "meta_conversion_settings" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "dataset_id" text,
  "test_event_code" text,
  "enabled_at" timestamptz,
  "backfilled_at" timestamptz,
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_conversion_settings_tenant_unique" ON "meta_conversion_settings" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_conversion_settings_updated_by_idx" ON "meta_conversion_settings" ("updated_by");
--> statement-breakpoint

-- Fila de saída: um evento por lead e etapa, enviado pelo job meta-conversions.
CREATE TABLE IF NOT EXISTS "meta_conversion_events" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "lead_id" text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "stage" text NOT NULL,
  "event_name" text NOT NULL,
  "event_id" text NOT NULL,
  "meta_lead_id" text NOT NULL,
  "event_time" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
  "last_error" text,
  "sent_at" timestamptz,
  "response" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "meta_conversion_events_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_conversion_events_tenant_lead_stage_unique" ON "meta_conversion_events" ("tenant_id", "lead_id", "stage");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "meta_conversion_events_tenant_event_id_unique" ON "meta_conversion_events" ("tenant_id", "event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_conversion_events_due_idx" ON "meta_conversion_events" ("status", "next_attempt_at", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_conversion_events_tenant_status_idx" ON "meta_conversion_events" ("tenant_id", "status", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meta_conversion_events_lead_idx" ON "meta_conversion_events" ("lead_id");
