import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

import { scoreInputFromMemory, scoreLead } from "./scoring";
import { getRecoverySettings } from "./settings";

/**
 * Fila "Sem resposta" (plano §6, fase 4): a marca `qualification_details.recovery = { state: "call_queue" }` por lead,
 * contada por unidade. O Call Âncora lê esta fila primeiro, pela pontuação. Saídas pelo resultado da ligação:
 * interesse vira lead do corretor; 3 tentativas sem atender ou "sem interesse" vão para a nutrição; número errado
 * vira "Não contatar".
 */

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

async function audit(tenantId: string, leadId: string, acao: string, userId?: string | null) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: userId ?? await resolveSystemUserId(tenantId), entidade: "lead", entidadeId: leadId, acao, createdAt: new Date() }).catch(() => undefined);
}

async function setRecovery(tenantId: string, leadId: string, value: Record<string, unknown>) {
  await getDatabase().update(schema.leads).set({
    qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', ${JSON.stringify(value)}::jsonb)`,
  }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)));
}

/** Pontuação na hora de entrar na fila, com o que o lead e a conversa já têm. */
export async function computeLeadScore(tenantId: string, leadId: string, now = new Date()) {
  const db = getDatabase();
  const [row] = rowsOf<{ queue_id: string | null; operator: string | null; memory: unknown; first_ai: string | null; first_in: string | null; last_in: string | null; replied: boolean }>(await db.execute(sql`
    select l.queue_id, coalesce(l.source_metadata->>'operadora', l.source_metadata->>'operator') as operator, conv.memory,
      msg.first_ai, msg.first_in, msg.last_in, msg.first_in is not null as replied
    from leads l
    left join lateral (select c.memory from ai_conversations c where c.tenant_id = l.tenant_id and c.lead_id = l.id order by c.updated_at desc limit 1) conv on true
    left join lateral (
      select min(m.sent_at) filter (where m.direction in ('outbound', 'outgoing') and m.sender_role = 'assistant') as first_ai,
        min(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as first_in,
        max(m.sent_at) filter (where m.direction in ('incoming', 'inbound')) as last_in
      from whatsapp_messages m where m.tenant_id = l.tenant_id and m.lead_id = l.id
    ) msg on true
    where l.tenant_id = ${tenantId} and l.id = ${leadId}
  `));
  if (!row) return scoreLead({ now });
  const firstReply = row.first_ai && row.first_in ? (new Date(row.first_in).getTime() - new Date(row.first_ai).getTime()) / 60_000 : null;
  return scoreLead({
    now,
    ...scoreInputFromMemory(row.memory),
    cityServed: Boolean(row.queue_id),
    operatorRequested: Boolean(row.operator),
    replied: Boolean(row.replied),
    firstReplyMinutes: firstReply !== null && firstReply >= 0 ? firstReply : null,
    lastInteractionAt: row.last_in,
  });
}

/** Coloca o lead na fila de ligação, com a pontuação. Não manda mensagem. */
export async function enterCallQueue(tenantId: string, leadId: string, from: "cadence" | "turbo_finished" | "manual" | "batch", now = new Date(), userId?: string | null) {
  const score = await computeLeadScore(tenantId, leadId, now);
  await setRecovery(tenantId, leadId, { state: "call_queue", at: now.toISOString(), from, score: score.label, rank: score.rank });
  await audit(tenantId, leadId, `recovery.call_queue:${from}`, userId);
  return score;
}

/**
 * R1 que terminou os lembretes do turbo sem responder entra na fila de ligação (só com a fila ligada e a
 * conferência jurídica registrada, porque ligação para frio é telemarketing).
 */
export async function sweepTurboFinishedIntoCallQueue(tenantId: string, now = new Date(), limit = 80) {
  const result = await getDatabase().execute(sql`
    select l.id from leads l
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null and l.corretor_id is null
      and l.status not in ('lost', 'converted')
      and l.qualification_details->'turbo'->>'stopReason' = 'finished'
      and l.qualification_details->'recovery'->>'state' is null
      and l.created_at >= ${new Date(now.getTime() - 30 * 86_400_000).toISOString()}::timestamptz
      and not exists (select 1 from whatsapp_messages i where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound'))
      and not exists (select 1 from ai_conversations c where c.tenant_id = l.tenant_id and c.lead_id = l.id and (c.opt_out_at is not null or c.wrong_number_at is not null))
    limit ${limit}
  `);
  const ids = rowsOf<{ id: string }>(result).map((row) => row.id);
  for (const id of ids) await enterCallQueue(tenantId, id, "turbo_finished", now);
  return ids.length;
}

/**
 * Saída da fila pelo resultado da ligação do Call Âncora. Só mexe em lead que está na fila. A nutrição só recebe o
 * lead com ela ligada; sem ela, o lead fica fora da fila com o motivo (nada mais é enviado).
 */
export async function applyCallQueueOutcome(input: { tenantId: string; leadId: string; outcome: "interested" | "not_interested" | "no_answer" | "voicemail" | "wrong_number"; assigned: boolean; attempts: number; maxAttempts: number; now?: Date }) {
  const db = getDatabase();
  const now = input.now ?? new Date();
  const [lead] = await db.select({ recovery: sql<unknown>`${schema.leads.qualificationDetails}->'recovery'` }).from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  const state = lead?.recovery && typeof lead.recovery === "object" ? (lead.recovery as { state?: string }).state : null;
  if (state !== "call_queue") return null;
  const settings = await getRecoverySettings(input.tenantId);
  const nurtureAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  if (input.outcome === "interested" && input.assigned) {
    await setRecovery(input.tenantId, input.leadId, { recoveredAt: now.toISOString(), from: "call_queue" });
    await audit(input.tenantId, input.leadId, "recovery.call_queue_recovered");
    return "recovered";
  }
  if (input.outcome === "wrong_number") {
    await setRecovery(input.tenantId, input.leadId, { state: "do_not_contact", at: now.toISOString(), reason: "wrong_number" });
    const [conversation] = await db.select({ id: schema.aiConversations.id }).from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.tenantId, input.tenantId), eq(schema.aiConversations.leadId, input.leadId))).orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
    if (conversation) await db.update(schema.aiConversations).set({ wrongNumberAt: now }).where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, input.tenantId)));
    await audit(input.tenantId, input.leadId, "recovery.do_not_contact:wrong_number");
    return "do_not_contact";
  }
  const exhausted = input.outcome === "not_interested" || input.attempts >= input.maxAttempts;
  if (!exhausted) return "stays";
  const reason = input.outcome === "not_interested" ? "not_interested" : "no_answer";
  await setRecovery(input.tenantId, input.leadId, settings.nurture
    ? { state: "nurture", at: now.toISOString(), until: nurtureAt, reason, touches: 0 }
    : { cadenceFinishedAt: now.toISOString(), reason, from: "call_queue" });
  await audit(input.tenantId, input.leadId, settings.nurture ? `recovery.nurture:${reason}` : `recovery.call_queue_finished:${reason}`);
  return settings.nurture ? "nurture" : "finished";
}

/** Fila de ligação por unidade: quantos e há quanto tempo (média), para a tela. */
export async function callQueueByBranch(tenantId: string, now = new Date()) {
  const result = await getDatabase().execute(sql`
    select coalesce(b.name, 'Sem unidade') as branch, l.branch_id,
      count(*)::int as total,
      avg(extract(epoch from (${now.toISOString()}::timestamptz - (l.qualification_details->'recovery'->>'at')::timestamptz)) / 3600)::float as avg_hours,
      count(*) filter (where (l.qualification_details->'recovery'->>'rank')::int >= 40)::int as profile_a
    from leads l left join branches b on b.id = l.branch_id
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.qualification_details->'recovery'->>'state' = 'call_queue'
    group by 1, 2 order by 3 desc
  `);
  return rowsOf<{ branch: string; branch_id: string | null; total: number; avg_hours: number | null; profile_a: number }>(result).map((row) => ({
    branch: row.branch, branchId: row.branch_id, total: Number(row.total) || 0, avgHours: row.avg_hours === null ? null : Math.round(Number(row.avg_hours)), profileA: Number(row.profile_a) || 0,
  }));
}

/** Segurados frios (manual_hold) que podem ir para a fila de ligação em lote: sem corretor, sem opt-out, sem marca. */
export async function moveHeldColdToCallQueue(tenantId: string, userId: string, limit = 300, now = new Date()) {
  const result = await getDatabase().execute(sql`
    select l.id from leads l
    where l.tenant_id = ${tenantId} and l.deleted_at is null and l.archived_at is null and l.corretor_id is null
      and l.status not in ('lost', 'converted') and l.qualification_status = 'cold' and l.distribution_status = 'manual_hold'
      and l.qualification_details->'recovery'->>'state' is null
      and not exists (select 1 from ai_conversations c where c.tenant_id = l.tenant_id and c.lead_id = l.id and (c.opt_out_at is not null or c.wrong_number_at is not null))
    order by l.created_at desc
    limit ${limit}
  `);
  const ids = rowsOf<{ id: string }>(result).map((row) => row.id);
  for (const id of ids) await enterCallQueue(tenantId, id, "batch", now, userId);
  return ids.length;
}
