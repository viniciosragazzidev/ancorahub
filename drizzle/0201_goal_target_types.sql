-- G5 Gestao de Equipes: metas de cotacoes, SLA e tempo de resposta (calculadas pela camada do G0).
-- Cada valor novo do enum em comando proprio. Nao use os valores na mesma transacao que os cria.
ALTER TYPE "goal_target_type" ADD VALUE IF NOT EXISTS 'quotes_count';

ALTER TYPE "goal_target_type" ADD VALUE IF NOT EXISTS 'sla_rate';

ALTER TYPE "goal_target_type" ADD VALUE IF NOT EXISTS 'response_minutes';
