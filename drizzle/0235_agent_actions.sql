-- Agente IA do diretor (21/11/2026): uma linha por ação de escrita feita pelo agente (pedido, entrada, aprovação,
-- resultado e Desfazer). Aditiva: só cria a tabela. Sem ela o agente funciona, mas sem Desfazer nem trilha.
-- Plano: docs/implementations/active/2026-11-21-agente-diretor.md
CREATE TABLE IF NOT EXISTS agent_actions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tool_call_id text NOT NULL,
  tool text NOT NULL,
  request_text text,
  input jsonb NOT NULL,
  approval text NOT NULL CHECK (approval IN ('auto', 'user')),
  status text NOT NULL CHECK (status IN ('done', 'failed', 'undone')),
  message text NOT NULL,
  undo jsonb,
  undone_at timestamp with time zone,
  duration_ms integer,
  purged_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS agent_actions_user_call_unique ON agent_actions (user_id, tool_call_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS agent_actions_tenant_user_created_idx ON agent_actions (tenant_id, user_id, created_at);
