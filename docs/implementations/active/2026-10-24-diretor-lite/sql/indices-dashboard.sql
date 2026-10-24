-- Índices da Visão da operação do painel (filtro de período 7/30 dias e de unidade).
-- Rodar no editor SQL do Supabase ANTES do deploy, UM comando por vez:
-- CREATE INDEX CONCURRENTLY não roda dentro de transação (não use BEGIN/COMMIT).
-- Todos usam IF NOT EXISTS: rodar de novo não faz nada.
-- Mesmo conteúdo de drizzle/0214_dashboard_overview_indexes.sql (fora do _journal, como a 0209).

-- "Chegaram" e "Leads por fila" (getDashboardToday) em 7/30 dias para a empresa toda:
-- leads vivos de um tenant criados desde o início da janela. Hoje não existe índice em created_at.
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_created_live_idx
  ON leads (tenant_id, created_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

-- Os mesmos números com uma unidade escolhida pelo Diretor (e o Gestor, cujo escopo é a unidade):
-- leads vivos de um tenant e unidade criados desde o início da janela.
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_branch_created_live_idx
  ON leads (tenant_id, branch_id, created_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

-- "Distribuídos" (getDashboardToday) e "Primeiro atendimento fora do SLA" (getAttentionSnapshot):
-- leads vivos com corretor, por data de distribuição (assigned_at) desde o início da janela.
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_tenant_assigned_live_idx
  ON leads (tenant_id, assigned_at)
  WHERE deleted_at IS NULL AND archived_at IS NULL AND corretor_id IS NOT NULL;
