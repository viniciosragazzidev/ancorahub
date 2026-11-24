-- Listas de importação do supervisor (24/11/2026, DEC-191): cada importação vira uma lista própria, como uma pasta de
-- leads ("Lista 24/11", "Lista 24/11 (2)" ou o nome que o supervisor der). Aditiva: cria a tabela e a coluna
-- `leads.import_list_id`. Sem ela o sistema continua com a lista única de antes (o código confere se a migration
-- está aplicada). O `id` da lista é o mesmo `importId` que a importação já gravava em `leads.source_metadata`.
CREATE TABLE IF NOT EXISTS supervisor_lead_lists (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id text REFERENCES branches(id) ON DELETE SET NULL,
  supervisor_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  legacy boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS supervisor_lead_lists_owner_created_idx ON supervisor_lead_lists (tenant_id, supervisor_id, created_at);
--> statement-breakpoint
ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_list_id text REFERENCES supervisor_lead_lists(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS leads_import_list_idx ON leads (import_list_id) WHERE import_list_id IS NOT NULL;
--> statement-breakpoint
-- Leads já importados: cada importação antiga já tinha o seu `importId`, então cada uma vira a lista que foi de
-- verdade, com o nome do dia em que entrou (horário de Brasília) e (2), (3) quando houve mais de uma no dia.
-- Entraram = leads gravados; duplicados vêm da auditoria `supervisor_import.created`; rejeitados não eram guardados (0).
INSERT INTO supervisor_lead_lists (id, tenant_id, branch_id, supervisor_id, name, imported_count, duplicate_count, rejected_count, legacy, created_at, updated_at)
SELECT g.import_id, g.tenant_id, g.branch_id, g.supervisor_id,
  'Lista ' || to_char(g.first_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM') || CASE WHEN g.day_rank > 1 THEN ' (' || g.day_rank || ')' ELSE '' END,
  g.total, coalesce(a.duplicates, 0), 0, false, g.first_at, now()
FROM (
  SELECT x.*, row_number() OVER (PARTITION BY x.tenant_id, x.supervisor_id, (x.first_at AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY x.first_at) AS day_rank
  FROM (
    SELECT l.source_metadata->>'importId' AS import_id, l.tenant_id, min(l.branch_id) AS branch_id,
      l.source_metadata->>'supervisorId' AS supervisor_id, min(l.created_at) AS first_at, count(*)::int AS total
    FROM leads l
    WHERE l.source_channel = 'supervisor_import'
      AND l.source_metadata->>'importId' IS NOT NULL
      AND l.source_metadata->>'supervisorId' IS NOT NULL
    GROUP BY 1, 2, 4
  ) x
) g
LEFT JOIN (
  SELECT entidade_id, sum(coalesce((metadata->>'duplicates')::int, 0))::int AS duplicates
  FROM audit_logs WHERE acao = 'supervisor_import.created' GROUP BY entidade_id
) a ON a.entidade_id = g.import_id
WHERE EXISTS (SELECT 1 FROM "user" u WHERE u.id = g.supervisor_id)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- Lead importado sem `importId` (não deveria existir): fica em "Importações anteriores", uma por supervisor.
INSERT INTO supervisor_lead_lists (id, tenant_id, branch_id, supervisor_id, name, imported_count, legacy, created_at, updated_at)
SELECT 'legacy-' || md5(l.tenant_id || ':' || (l.source_metadata->>'supervisorId')), l.tenant_id, min(l.branch_id),
  l.source_metadata->>'supervisorId', 'Importações anteriores', count(*)::int, true, min(l.created_at), now()
FROM leads l
WHERE l.source_channel = 'supervisor_import'
  AND l.source_metadata->>'importId' IS NULL
  AND l.source_metadata->>'supervisorId' IS NOT NULL
  AND EXISTS (SELECT 1 FROM "user" u WHERE u.id = l.source_metadata->>'supervisorId')
GROUP BY l.tenant_id, l.source_metadata->>'supervisorId'
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE leads l SET import_list_id = coalesce(l.source_metadata->>'importId', 'legacy-' || md5(l.tenant_id || ':' || (l.source_metadata->>'supervisorId')))
WHERE l.source_channel = 'supervisor_import'
  AND l.import_list_id IS NULL
  AND l.source_metadata->>'supervisorId' IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM supervisor_lead_lists s
    WHERE s.id = coalesce(l.source_metadata->>'importId', 'legacy-' || md5(l.tenant_id || ':' || (l.source_metadata->>'supervisorId')))
  );
