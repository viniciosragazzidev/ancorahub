import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

import { buildQualificationRow, type QualificationLeadRow, type QualificationLeadSource } from "./rows";
import { buildTimeline, type TimelineItem, type TimelineSource } from "./timeline";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

export type QualificationLeadsFilter = {
  /** Início da janela (entrada do lead), o mesmo dia de operação das outras telas. */
  since: Date;
  queueId?: string | null;
};

/** Limite de linhas: a tela é de trabalho, não relatório; o resumo do topo diz quando cortou. */
export const QUALIFICATION_LEADS_LIMIT = 600;

/**
 * Leads que passaram pela qualificação no intervalo, com o que a etapa precisa (fase 1 do plano de recuperação).
 * Uma consulta: o lead, a conversa de IA mais recente, as mensagens resumidas e o estado do turbo.
 */
export async function listQualificationLeads(tenantId: string, filter: QualificationLeadsFilter, now = new Date()) {
  const since = filter.since.toISOString();
  const db = getDatabase();
  const result = await db.execute(sql`
    select l.id, l.nome, l.telefone, l.status::text as status, l.qualification_status, l.corretor_id,
      l.assigned_at, l.first_contact_at, l.distribution_status, l.created_at, l.source_channel, l.lives_count,
      l.queue_id, q.name as queue_name, u.name as broker_name,
      l.qualification_details->'turbo' as turbo,
      l.qualification_details->'recovery' as recovery,
      conv.opt_out_at, conv.wrong_number_at, conv.memory->'collectedFields' as collected_fields,
      jsonb_build_object('planType', conv.memory->'planType', 'numberOfLives', conv.memory->'numberOfLives', 'age', conv.memory->'age', 'averageAge', conv.memory->'averageAge', 'companyHasCnpj', conv.memory->'companyHasCnpj') as score_memory,
      coalesce(l.source_metadata->>'operadora', l.source_metadata->>'operator') as operator,
      msg.inbound_count, msg.last_inbound_at, msg.last_ai_at, msg.first_ai_at, msg.first_inbound_at,
      exists (select 1 from whatsapp_messages s where s.tenant_id = l.tenant_id and s.lead_id = l.id
        and s.id like 'ai\\_silence\\_followup\\_%' and s.provider_status = 'sent') as silence_sent
    from leads l
    left join lead_queues q on q.id = l.queue_id and q.tenant_id = l.tenant_id
    left join "user" u on u.id = l.corretor_id
    left join lateral (
      select c.opt_out_at, c.wrong_number_at, c.memory from ai_conversations c
      where c.tenant_id = l.tenant_id and c.lead_id = l.id order by c.updated_at desc limit 1
    ) conv on true
    left join lateral (
      select count(*) filter (where m.direction in ('incoming', 'inbound'))::int as inbound_count,
        max(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as last_inbound_at,
        max(m.sent_at) filter (where m.direction in ('outbound', 'outgoing') and m.sender_role = 'assistant') as last_ai_at,
        min(m.sent_at) filter (where m.direction in ('outbound', 'outgoing') and m.sender_role = 'assistant') as first_ai_at,
          min(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as first_inbound_at
      from whatsapp_messages m where m.tenant_id = l.tenant_id and m.lead_id = l.id
    ) msg on true
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null
      and l.created_at >= ${since}::timestamptz
      and coalesce(l.source_channel, '') <> 'supervisor_import'
      ${filter.queueId ? sql`and l.queue_id = ${filter.queueId}` : sql``}
    order by l.created_at desc
    limit ${QUALIFICATION_LEADS_LIMIT}
  `);
  const sources = rowsOf<QualificationLeadSource>(result);
  return sources.map((source) => buildQualificationRow(source, now));
}

/** Filas da empresa para o filtro (nome e id). */
export async function listQueueOptions(tenantId: string) {
  const db = getDatabase();
  const result = await db.execute(sql`select id, name from lead_queues where tenant_id = ${tenantId} order by name`);
  return rowsOf<{ id: string; name: string }>(result);
}

function leadRowQuery(tenantId: string, leadId: string) {
  return getDatabase().execute(sql`
      select l.id, l.nome, l.telefone, l.status::text as status, l.qualification_status, l.corretor_id,
        l.assigned_at, l.first_contact_at, l.distribution_status, l.created_at, l.source_channel, l.lives_count,
        l.queue_id, q.name as queue_name, u.name as broker_name,
        l.qualification_details->'turbo' as turbo, l.qualification_details->'recovery' as recovery,
        conv.opt_out_at, conv.wrong_number_at, conv.memory->'collectedFields' as collected_fields,
      jsonb_build_object('planType', conv.memory->'planType', 'numberOfLives', conv.memory->'numberOfLives', 'age', conv.memory->'age', 'averageAge', conv.memory->'averageAge', 'companyHasCnpj', conv.memory->'companyHasCnpj') as score_memory,
      coalesce(l.source_metadata->>'operadora', l.source_metadata->>'operator') as operator, conv.memory as memory,
        msg.inbound_count, msg.last_inbound_at, msg.last_ai_at, msg.first_ai_at, msg.first_inbound_at,
        exists (select 1 from whatsapp_messages s where s.tenant_id = l.tenant_id and s.lead_id = l.id
          and s.id like 'ai\\_silence\\_followup\\_%' and s.provider_status = 'sent') as silence_sent
      from leads l
      left join lead_queues q on q.id = l.queue_id and q.tenant_id = l.tenant_id
      left join "user" u on u.id = l.corretor_id
      left join lateral (
        select c.opt_out_at, c.wrong_number_at, c.memory from ai_conversations c
        where c.tenant_id = l.tenant_id and c.lead_id = l.id order by c.updated_at desc limit 1
      ) conv on true
      left join lateral (
        select count(*) filter (where m.direction in ('incoming', 'inbound'))::int as inbound_count,
          max(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as last_inbound_at,
          max(m.sent_at) filter (where m.direction in ('outbound', 'outgoing') and m.sender_role = 'assistant') as last_ai_at,
          min(m.sent_at) filter (where m.direction in ('outbound', 'outgoing') and m.sender_role = 'assistant') as first_ai_at,
          min(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as first_inbound_at
        from whatsapp_messages m where m.tenant_id = l.tenant_id and m.lead_id = l.id
      ) msg on true
      where l.tenant_id = ${tenantId} and l.id = ${leadId} and l.deleted_at is null
      limit 1
    `);
}

/** Linha crua e etapa de um lead (recuperação na gaveta precisa do turbo e da marca de recuperação crus). */
export async function getLeadJourneySource(tenantId: string, leadId: string, now = new Date()) {
  const source = rowsOf<QualificationLeadSource>(await leadRowQuery(tenantId, leadId))[0];
  return source ? { source, row: buildQualificationRow(source, now) } : null;
}

/** Etapa de um lead (ficha e conversas), sem a linha do tempo. */
export async function getLeadJourneyRow(tenantId: string, leadId: string) {
  const source = rowsOf<QualificationLeadSource>(await leadRowQuery(tenantId, leadId))[0];
  return source ? buildQualificationRow(source) : null;
}

/**
 * Linha do tempo da qualificação de um lead: mensagens, toques da cadência, marcos do funil e auditoria.
 * Nada é gravado só para esta tela.
 */
export async function getQualificationTimeline(tenantId: string, leadId: string): Promise<{ row: QualificationLeadRow | null; items: TimelineItem[] }> {
  const db = getDatabase();
  const [leadRows, messages, events, audits] = await Promise.all([
    leadRowQuery(tenantId, leadId),
    db.execute(sql`
      select id, direction, sender_role, body, provider, provider_status, sent_at
      from whatsapp_messages where tenant_id = ${tenantId} and lead_id = ${leadId}
      order by sent_at desc nulls last limit 120
    `),
    db.execute(sql`
      select event, step_key, occurred_at, metadata from lead_funnel_events
      where tenant_id = ${tenantId} and lead_id = ${leadId} order by occurred_at desc limit 80
    `),
    db.execute(sql`
      select acao, created_at from audit_logs
      where entidade = 'lead' and entidade_id = ${leadId}
        and (acao like 'qualification.%' or acao like 'recovery.%' or acao like 'cold%' or acao like 'distribution.%')
      order by created_at desc limit 60
    `),
  ]);
  const source = rowsOf<QualificationLeadSource & { memory: unknown }>(leadRows)[0];
  if (!source) return { row: null, items: [] };
  const timelineSource: TimelineSource = {
    messages: rowsOf(messages),
    events: rowsOf(events),
    audits: rowsOf(audits),
    turbo: source.turbo,
    memory: source.memory,
  };
  return { row: buildQualificationRow(source), items: buildTimeline(timelineSource) };
}
