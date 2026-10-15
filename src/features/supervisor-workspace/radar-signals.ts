import "server-only";

import { and, count, inArray, isNull, lt, sql } from "drizzle-orm";

import { getLeadTagsByLead } from "@/features/lead-tags/service";
import { isOutgoingDirection } from "@/features/team-conversations/direction";
import { getDatabase, schema } from "@/shared/db";

import type { RadarLead } from "./supervisor-leads-radar";

/**
 * The alerts the team list shows on top of the lead rows: its tags, whether the client wrote last
 * on WhatsApp (and is waiting), and how many of its tasks are past due. The leads are already in
 * the viewer's scope, so everything here is read by tenant and lead id.
 */
export async function withRadarSignals(tenantId: string, leads: RadarLead[], now = new Date()): Promise<RadarLead[]> {
  if (!leads.length) return [];
  const ids = leads.map((lead) => lead.id);
  const db = getDatabase();
  const [tags, lastMessages, overdue] = await Promise.all([
    getLeadTagsByLead(tenantId, ids),
    db.execute<{ lead_id: string; direction: string; sent_at: Date | string }>(sql`
      select distinct on (${schema.whatsappMessages.leadId}) ${schema.whatsappMessages.leadId} as lead_id,
        ${schema.whatsappMessages.direction} as direction, ${schema.whatsappMessages.sentAt} as sent_at
      from ${schema.whatsappMessages}
      where ${schema.whatsappMessages.tenantId} = ${tenantId} and ${inArray(schema.whatsappMessages.leadId, ids)}
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
  ]);
  const rows = (Array.isArray(lastMessages) ? lastMessages : (lastMessages as { rows?: unknown[] }).rows ?? []) as Array<{ lead_id: string; direction: string; sent_at: Date | string }>;
  const waitingSince = new Map(rows.filter((row) => !isOutgoingDirection(String(row.direction))).map((row) => [row.lead_id, new Date(row.sent_at).toISOString()]));
  const overdueByLead = new Map(overdue.map((row) => [row.leadId, Number(row.total)]));
  return leads.map((lead) => ({
    ...lead,
    tags: (tags.get(lead.id) ?? []).map((tag) => ({ id: tag.id, name: tag.name, colorHue: tag.colorHue ?? null })),
    clientWaitingSince: waitingSince.get(lead.id) ?? null,
    overdueTasks: overdueByLead.get(lead.id) ?? 0,
  }));
}
