import "server-only";

import { and, count, eq, inArray, isNull, lt, max, sql } from "drizzle-orm";

import { getLeadTagsByLead } from "@/features/lead-tags/service";
import { isOutgoingDirection } from "@/features/team-conversations/direction";
import { getDatabase, schema } from "@/shared/db";

import type { RadarLead } from "./supervisor-leads-radar";

/** Audit actions of a broker answering the lead (stage changes and start of service). */
const BROKER_ATTENDANCE_ACTIONS = ["alterou", "perdeu", "reabriu", "iniciou_atendimento_whatsapp", "iniciou_atendimento_primeira_mensagem", "assumiu_atendimento"];

/**
 * The alerts the team list shows on top of the lead rows: its tags, whether the client wrote last
 * on WhatsApp (and is waiting), and how many of its tasks are past due. The leads are already in
 * the viewer's scope, so everything here is read by tenant and lead id.
 */
export async function withRadarSignals(tenantId: string, leads: RadarLead[], now = new Date()): Promise<RadarLead[]> {
  if (!leads.length) return [];
  const ids = leads.map((lead) => lead.id);
  const db = getDatabase();
  const [tags, lastMessages, overdue, brokerActions] = await Promise.all([
    getLeadTagsByLead(tenantId, ids),
    db.execute<{ lead_id: string; direction: string; sent_at: Date | string }>(sql`
      select distinct on (${schema.whatsappMessages.leadId}) ${schema.whatsappMessages.leadId} as lead_id,
        ${schema.whatsappMessages.direction} as direction, ${schema.whatsappMessages.sentAt} as sent_at
      from ${schema.whatsappMessages}
      where ${schema.whatsappMessages.tenantId} = ${tenantId} and ${inArray(schema.whatsappMessages.leadId, ids)}
        and not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))
      order by ${schema.whatsappMessages.leadId}, ${schema.whatsappMessages.sentAt} desc
    `),
    db.select({ leadId: schema.leadTasks.leadId, total: count() }).from(schema.leadTasks)
      .where(and(
        sql`${schema.leadTasks.tenantId} = ${tenantId}`,
        inArray(schema.leadTasks.leadId, ids),
        isNull(schema.leadTasks.completedAt),
        lt(schema.leadTasks.dueAt, now),
      ))
      .groupBy(schema.leadTasks.leadId),
    // The owner's own last attendance action on each lead (stage, start of service): automatic moves by
    // the IA, distribution or management, and edits like tags, do not count.
    db.select({ leadId: schema.auditLogs.entidadeId, userId: schema.auditLogs.userId, at: max(schema.auditLogs.createdAt) }).from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entidade, "lead"),
        inArray(schema.auditLogs.entidadeId, ids),
        inArray(schema.auditLogs.userId, [...new Set(leads.map((lead) => lead.ownerId))]),
        inArray(schema.auditLogs.acao, BROKER_ATTENDANCE_ACTIONS),
      ))
      .groupBy(schema.auditLogs.entidadeId, schema.auditLogs.userId),
  ]);
  const rows = (Array.isArray(lastMessages) ? lastMessages : (lastMessages as { rows?: unknown[] }).rows ?? []) as Array<{ lead_id: string; direction: string; sent_at: Date | string }>;
  // The client is waiting only if he wrote after the broker last acted on the lead: a stage the broker
  // registered later (e.g. "Cotação enviada") means he answered outside the system.
  const ownerOf = new Map(leads.map((lead) => [lead.id, lead.ownerId]));
  const brokerActedAt = new Map(brokerActions
    .filter((action) => action.at && ownerOf.get(action.leadId) === action.userId)
    .map((action) => [action.leadId, new Date(action.at!).getTime()]));
  const waitingSince = new Map(rows
    .filter((row) => !isOutgoingDirection(String(row.direction)) && new Date(row.sent_at).getTime() > (brokerActedAt.get(row.lead_id) ?? 0))
    .map((row) => [row.lead_id, new Date(row.sent_at).toISOString()]));
  const overdueByLead = new Map(overdue.map((row) => [row.leadId, Number(row.total)]));
  return leads.map((lead) => ({
    ...lead,
    tags: (tags.get(lead.id) ?? []).map((tag) => ({ id: tag.id, name: tag.name, colorHue: tag.colorHue ?? null })),
    clientWaitingSince: waitingSince.get(lead.id) ?? null,
    overdueTasks: overdueByLead.get(lead.id) ?? 0,
  }));
}
