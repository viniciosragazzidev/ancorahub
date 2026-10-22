import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { buildConversationLeadScope } from "@/features/conversations/lead-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { canReadTeamConversations, isOutgoingDirection } from "./direction";

export { canReadTeamConversations, isOutgoingDirection };

export type { TeamConversationDetail, TeamConversationMessage, TeamConversationSummary } from "./types";
import type { TeamConversationDetail, TeamConversationSummary } from "./types";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";

/**
 * Conversations of the brokers the viewer manages, newest first: one row per lead with its last
 * WhatsApp message. Scope comes from the session (unit for the manager, team for the supervisor).
 */
export async function listTeamConversations(context: TenantContext, limit = 120): Promise<TeamConversationSummary[]> {
  if (!canReadTeamConversations(context)) return [];
  const scope = buildConversationLeadScope(context);
  const rows = await getDatabase().execute<{
    lead_id: string; lead_name: string; broker_id: string | null; broker_name: string | null;
    body: string; direction: string; sender_role: string | null; sent_at: Date | string; total: number | string;
  }>(sql`
    select ${schema.leads.id} as lead_id, ${schema.leads.nome} as lead_name,
      ${schema.leads.corretorId} as broker_id, ${schema.user.name} as broker_name,
      last.body, last.direction, last.sender_role, last.sent_at, last.total
    from ${schema.leads}
    join lateral (
      select wm.body, wm.direction, wm.sender_role, wm.sent_at,
        (select count(*) from whatsapp_messages c where c.tenant_id = ${schema.leads.tenantId} and c.lead_id = ${schema.leads.id}) as total
      from whatsapp_messages wm
      where wm.tenant_id = ${schema.leads.tenantId} and wm.lead_id = ${schema.leads.id}
      order by wm.sent_at desc
      limit 1
    ) last on true
    left join ${schema.user} on ${schema.user.id} = ${schema.leads.corretorId}
    where ${scope} and ${schema.leads.deletedAt} is null
    order by last.sent_at desc
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? [];
  return (list as Array<Record<string, unknown>>).map((row) => ({
    leadId: String(row.lead_id),
    leadName: String(row.lead_name ?? "Lead"),
    brokerId: (row.broker_id as string | null) ?? null,
    brokerName: (row.broker_name as string | null) ?? null,
    lastBody: String(row.body ?? ""),
    lastAt: new Date(row.sent_at as string).toISOString(),
    lastFromClient: !isOutgoingDirection(String(row.direction ?? "")),
    lastByAi: row.sender_role === "assistant",
    messages: Number(row.total ?? 0),
  }));
}

/** One conversation, read only. Null when the lead is outside the viewer's unit or team. */
export async function getTeamConversation(context: TenantContext, leadId: string, limit = 400): Promise<TeamConversationDetail | null> {
  if (!canReadTeamConversations(context)) return null;
  const db = getDatabase();
  const [lead] = await db
    .select({ id: schema.leads.id, name: schema.leads.nome, brokerName: schema.user.name })
    .from(schema.leads)
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(eq(schema.leads.id, leadId), buildConversationLeadScope(context), sql`${schema.leads.deletedAt} is null`))
    .limit(1);
  if (!lead) return null;

  const messages = await db
    .select({
      id: schema.whatsappMessages.id,
      body: schema.whatsappMessages.body,
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      sentAt: schema.whatsappMessages.sentAt,
      mediaKind: schema.whatsappMessages.mediaKind,
    })
    .from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, lead.id), notStatusBroadcastSql(schema.whatsappMessages.messageId), sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`))
    .orderBy(asc(schema.whatsappMessages.sentAt))
    .limit(limit);

  return {
    leadId: lead.id,
    leadName: lead.name,
    brokerName: lead.brokerName ?? null,
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      at: message.sentAt.toISOString(),
      fromClient: !isOutgoingDirection(message.direction),
      byAi: message.senderRole === "assistant",
      mediaKind: message.mediaKind ?? null,
    })),
  };
}
