-- Velocidade (24/11/2026): o contador de notificações não lidas roda em toda tela
-- (sino do topo, /api/internal/unread-count). Sem índice para "não lidas", cada chamada
-- lia todas as notificações do usuário (55 a 65 mil cada): média de 313 ms, máx. 9,8 s,
-- 350 mil chamadas desde 26/10 (pg_stat_statements).
--
-- Como a 0209 e a 0214, este arquivo fica fora do journal: rode no editor SQL do
-- Supabase antes do deploy (CONCURRENTLY não roda dentro de transação).
-- Aplicado em produção em 24/11/2026.
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_recipient_unread_idx
  ON notifications (tenant_id, recipient_user_id)
  WHERE read_at IS NULL;
