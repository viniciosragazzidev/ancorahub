import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

import { assessCustomerWaiting, type CustomerWaitingAssessment, type CustomerWaitingMessage, type CustomerWaitingPolicy } from "./domain";

/** Active statuses where a broker owns the conversation (same list as Negociações, plus "distributed"). */
export const CUSTOMER_WAITING_STATUSES = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "awaiting_reply"] as const;

export type CustomerWaitingLead = {
  leadId: string;
  leadName: string;
  branchId: string | null;
  brokerId: string;
  assignedAt: string | null;
  assessment: CustomerWaitingAssessment;
};

type Row = {
  lead_id: string;
  lead_name: string;
  branch_id: string | null;
  broker_id: string;
  assigned_at: Date | string | null;
  direction: string;
  sender_role: string | null;
  body: string | null;
  media_kind: string | null;
  sent_at: Date | string;
};

function rowsOf(result: unknown) {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Row[];
}

/**
 * Leads of one tenant whose customer is waiting for a person: the messages of the last `lookbackDays` of each
 * candidate go through the pure rules. Candidates are active leads with a broker and a customer message newer than
 * the last answer (a person's, or the AI's before the assignment). `leadIds` narrows to one screen's leads.
 */
export async function loadCustomerWaitingLeads(input: {
  tenantId: string;
  now: Date;
  lookbackDays: number;
  leadIds?: readonly string[];
  policy?: CustomerWaitingPolicy;
}): Promise<CustomerWaitingLead[]> {
  if (input.leadIds && !input.leadIds.length) return [];
  const since = new Date(input.now.getTime() - input.lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const statuses = sql.join(CUSTOMER_WAITING_STATUSES.map((status) => sql`${status}`), sql`, `);
  const leadFilter = input.leadIds ? sql`and l.id in (${sql.join(input.leadIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const result = await getDatabase().execute(sql`
    with lead_scope as materialized (
      select l.id, l.nome, l.branch_id, l.corretor_id, l.assigned_at
      from leads l
      where l.tenant_id = ${input.tenantId}
        and l.status in (${statuses})
        and l.corretor_id is not null
        and l.archived_at is null
        and l.deleted_at is null
        ${leadFilter}
    ), last_answer as (
      select m.lead_id, max(m.sent_at) as at
      from whatsapp_messages m
      inner join lead_scope l on l.id = m.lead_id
      where m.tenant_id = ${input.tenantId}
        and (m.direction = 'outgoing'
          or (m.direction = 'outbound' and (coalesce(m.sender_role, '') not in ('assistant', 'system') or m.sent_at < coalesce(l.assigned_at, 'infinity'::timestamptz))))
      group by m.lead_id
    ), pending as (
      select l.*
      from lead_scope l
      left join last_answer a on a.lead_id = l.id
      where exists (
        select 1 from whatsapp_messages i
        where i.tenant_id = ${input.tenantId}
          and i.lead_id = l.id
          and i.direction = 'incoming'
          and i.sent_at >= ${since}::timestamptz
          and i.sent_at > coalesce(a.at, '-infinity'::timestamptz)
      )
    )
    select p.id as lead_id, p.nome as lead_name, p.branch_id, p.corretor_id as broker_id, p.assigned_at,
      m.direction, m.sender_role, m.body, m.media_kind, m.sent_at
    from pending p
    inner join whatsapp_messages m on m.lead_id = p.id and m.tenant_id = ${input.tenantId}
    where m.sent_at >= ${since}::timestamptz
    order by p.id, m.sent_at
  `);

  const byLead = new Map<string, { head: Row; messages: CustomerWaitingMessage[] }>();
  for (const row of rowsOf(result)) {
    const entry = byLead.get(row.lead_id) ?? { head: row, messages: [] };
    entry.messages.push({ direction: row.direction, senderRole: row.sender_role, body: row.body, mediaKind: row.media_kind, sentAt: row.sent_at });
    byLead.set(row.lead_id, entry);
  }

  const leads: CustomerWaitingLead[] = [];
  for (const [leadId, { head, messages }] of byLead) {
    const assessment = assessCustomerWaiting({ messages, assignedAt: head.assigned_at, now: input.now, policy: input.policy });
    if (!assessment) continue;
    leads.push({
      leadId,
      leadName: head.lead_name,
      branchId: head.branch_id,
      brokerId: head.broker_id,
      assignedAt: head.assigned_at ? new Date(head.assigned_at).toISOString() : null,
      assessment,
    });
  }
  return leads;
}
