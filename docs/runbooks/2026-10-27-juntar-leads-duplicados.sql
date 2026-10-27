-- Junta os 7 pares de leads duplicados pela corrida de mensagens simultâneas (27/10).
-- Corrigido no código em fix/lead-intake-phone-race; este script limpa o que já nasceu duplicado.
--
-- Para cada par: o histórico (mensagens, timeline, tarefas, cotações, envios, tags…) passa
-- para o lead que fica; ofertas, jobs e efeitos ainda abertos do lead que sai são cancelados;
-- o lead que sai é marcado como apagado (deleted_at), sem apagar nada de verdade.
-- Ficam no lead apagado, só como registro: sessão de qualificação, conversa da IA, fluxo de
-- atendimento, jobs e efeitos já processados, cadência WAHA e cliente (cada um é único por lead).
--
-- Rodar inteiro no SQL Editor. Está em begin/commit: se qualquer linha falhar, nada muda.
begin;

create temp table merge_map (keep_id text primary key, drop_id text unique not null) on commit drop;
insert into merge_map (keep_id, drop_id) values
  ('78af565e-ca33-4b51-b6df-2454a4eb913d', '5045d127-f1a2-4a93-8c72-35f94e2a5e3c'), -- João Batista: o mais antigo
  ('f57b0e4d-c751-4d58-a5fb-97d5e520d0e5', '3c6b2d19-b2b1-4172-be7d-15a4e845ad8b'), -- Valéria: o que tem corretor
  ('510dbf34-8279-4881-979f-99e2b0714088', 'a575b6b5-0fb1-4311-9a2b-8655b2c670ba'), -- Amandão: o mais antigo
  ('39989bb2-630e-474f-b508-07c56e5bbfdd', '26d2fcb6-eb85-4ab5-9ea9-836176e1f691'), -- Joelma: Lia Alves (21 msgs, quente)
  ('12096e14-525c-4c79-a6cc-d2bb6d29edd1', '152a6255-db0d-41d1-baac-08ead9fa7834'), -- D.: Lilian Martins (33 msgs)
  ('4395b8ea-48c1-425f-b7b2-18622c0e17f5', '5f0fbd12-fe23-42d0-a3cc-e575832bf535'), -- Marcio Dias: o que tem corretor
  ('f2922010-b639-47ac-a099-763c0addf461', '3f61d28e-4486-4e46-ac1f-806a2a5f2fb7'); -- A P: corretor e quente

-- 1. Histórico: passa para o lead que fica.
update whatsapp_messages t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_interactions t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update notifications t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_distribution_events t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_feedbacks t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_assignment_attempts t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update ai_attendance_logs t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update ai_quick_reply_events t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update situation_learning_events t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update webhook_deliveries t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_tasks t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update quotes t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_beneficiaries t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_documents t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update lead_document_checklist t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update proposals t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update sales t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update crm_automation_logs t set lead_id = m.keep_id from merge_map m where t.lead_id = m.drop_id;
update whatsapp_outbound_messages t set recipient_id = m.keep_id from merge_map m where t.recipient_type = 'lead' and t.recipient_id = m.drop_id;
-- Tags: só as que o lead que fica ainda não tem (a chave é lead + tag).
update lead_tag_assignments t set lead_id = m.keep_id from merge_map m
where t.lead_id = m.drop_id
  and not exists (select 1 from lead_tag_assignments k where k.lead_id = m.keep_id and k.tag_id = t.tag_id);

-- 2. O que ainda estava aberto no lead que sai: cancelado, para não agir sobre ele.
update lead_offers t set status = 'CANCELLED' from merge_map m
where t.lead_id = m.drop_id and t.status not in ('ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'LOST');
update lead_distribution_jobs t set status = 'cancelled' from merge_map m
where t.lead_id = m.drop_id and t.status in ('pending', 'retrying', 'processing');
update lead_effect_outbox t set status = 'cancelled' from merge_map m
where t.lead_id = m.drop_id and t.status in ('pending', 'retrying', 'processing');

-- 3. Nota na timeline do lead que fica.
insert into lead_interactions (id, lead_id, user_id, tipo, conteudo)
select gen_random_uuid()::text, m.keep_id, i.user_id, 'note',
       '📝 Este lead tinha sido criado em dobro (duas mensagens chegaram ao mesmo tempo). As mensagens e o histórico do outro foram trazidos para cá.'
from merge_map m
join lateral (select user_id from lead_interactions where lead_id = m.keep_id order by created_at limit 1) i on true;

-- 4. O lead que sai fica apagado (recuperável: basta limpar deleted_at).
update leads l set deleted_at = now(), updated_at = now() from merge_map m where l.id = m.drop_id;

-- Conferência: cada lead que fica com o total de mensagens; os que saíram, apagados.
select m.keep_id, k.nome,
       (select count(*) from whatsapp_messages w where w.lead_id = m.keep_id) as mensagens,
       d.deleted_at is not null as duplicado_apagado
from merge_map m join leads k on k.id = m.keep_id join leads d on d.id = m.drop_id;

commit;
