-- Histórico do prompt da IA de qualificação e playbooks fora do texto livre (26/11/2026).
-- Aditiva: só cria as duas tabelas. Sem elas, salvar continua gravando por cima como antes, os playbooks seguem
-- dentro de custom_instructions (marcador ---SITUATIONAL_PLAYBOOKS_JSON---) e o "Histórico" avisa que falta a
-- migration (o código confere com to_regclass antes de usar).
CREATE TABLE IF NOT EXISTS ai_qualification_config_versions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  restored_from_version integer,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ai_qualification_config_versions_tenant_version_unique ON ai_qualification_config_versions (tenant_id, version);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS ai_qualification_playbooks (
  tenant_id text PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  playbooks jsonb NOT NULL,
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
