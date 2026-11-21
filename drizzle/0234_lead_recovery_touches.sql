-- Recuperação de leads, fase 2 (21/11/2026): um registro por toque de recuperação (lembrete, follow-up,
-- ligação, nutrição), com passo, canal, resultado, resposta e custo estimado. Base do funil de recuperação
-- (/qualificacao/recuperacao) e da cadência única (fase 3). Aditiva: só cria a tabela e índices. Sem a tabela,
-- os envios seguem como hoje e o funil lê só o que já existe (turbo e follow-up de silêncio).
-- Plano: docs/implementations/active/2026-11-21-recuperacao-de-leads.md
CREATE TABLE IF NOT EXISTS lead_recovery_touches (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  segment text NOT NULL CHECK (segment IN ('never_replied', 'stopped_midway', 'warm', 'call_queue', 'nurture')),
  step text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  channel text CHECK (channel IN ('meta', 'waha', 'call')),
  template text,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed', 'held')),
  reason text,
  error_code text,
  outbound_id text,
  message_id text,
  cost_brl numeric(10, 4) NOT NULL DEFAULT 0,
  control_group boolean NOT NULL DEFAULT false,
  replied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS lead_recovery_touches_once_unique ON lead_recovery_touches (tenant_id, lead_id, step, attempt);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_recovery_touches_tenant_created_idx ON lead_recovery_touches (tenant_id, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_recovery_touches_lead_idx ON lead_recovery_touches (lead_id, created_at);
