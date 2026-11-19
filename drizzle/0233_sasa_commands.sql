-- Sasá agêntica, fase 2 (19/11/2026): um registro por pedido à Sasá (texto ou voz).
-- Aditiva: só cria a tabela. Áudio nunca é guardado; transcript e reply são apagados após 90 dias
-- pelo job /api/internal/jobs/sasa-cleanup. Sem a tabela, a Sasá continua funcionando (sem teto e sem histórico).
-- Plano: docs/implementations/active/2026-11-19-sasa-agentica.md
CREATE TABLE IF NOT EXISTS sasa_commands (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_command_id text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('text', 'voice')),
  transcript text,
  audio_seconds numeric(8, 2),
  tool text,
  via text,
  status text NOT NULL,
  picked_lead_id text,
  reply jsonb,
  purged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS sasa_commands_user_client_unique ON sasa_commands (user_id, client_command_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sasa_commands_tenant_user_created_idx ON sasa_commands (tenant_id, user_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sasa_commands_purge_idx ON sasa_commands (created_at) WHERE purged_at IS NULL;
