import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

import { summarizeFollowupStats, type FollowupStatRow, type FollowupStats } from "./followup-stats-core";

/** Window of the "Follow-ups" card on the Overview (recovery plan, phase 0). */
const WINDOW_DAYS = 30;

/**
 * Real follow-up numbers (21/11/2026), replacing the fixed zero: the turbo reminders (T1 to T4, kept in
 * `qualification_details.turbo.touches`) and the silence follow-up (message id `ai_silence_followup_*`).
 * One row per lead that got at least one follow-up in the window. Plan:
 * docs/implementations/active/2026-11-21-recuperacao-de-leads.md, phase 0.
 */
export async function getFollowupStats(tenantId: string, now = new Date()): Promise<FollowupStats> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60_000).toISOString();
  const db = getDatabase();
  const result = await db.execute(sql`
    with turbo as (
      select l.id as lead_id,
        count(*) filter (where t->>'status' = 'sent')::int as sent,
        count(*) filter (where t->>'status' = 'skipped')::int as skipped,
        min((t->>'at')::timestamptz) filter (where t->>'status' = 'sent') as first_sent_at
      from leads l
      cross join lateral jsonb_array_elements(coalesce(l.qualification_details->'turbo'->'touches', '[]'::jsonb)) t
      where l.tenant_id = ${tenantId} and l.deleted_at is null
        and t->>'touch' not in ('t0', 'reactivation')
        and (t->>'at')::timestamptz >= ${since}::timestamptz
      group by l.id
    ),
    silence as (
      select m.lead_id, count(*)::int as sent, min(m.sent_at) as first_sent_at
      from whatsapp_messages m
      where m.tenant_id = ${tenantId} and m.id like 'ai\\_silence\\_followup\\_%'
        and m.provider_status = 'sent' and m.sent_at >= ${since}::timestamptz
      group by m.lead_id
    ),
    touched as (
      select coalesce(t.lead_id, s.lead_id) as lead_id,
        coalesce(t.sent, 0) + coalesce(s.sent, 0) as sent,
        coalesce(t.skipped, 0) as skipped,
        least(t.first_sent_at, s.first_sent_at) as first_sent_at
      from turbo t full outer join silence s on s.lead_id = t.lead_id
    )
    select x.sent, x.skipped,
      l.qualification_details->'turbo'->>'stopReason' as stop_reason,
      (l.qualification_details->'turbo'->>'firstContactAt') is not null
        and (l.qualification_details->'turbo'->>'stoppedAt') is null as cadence_active,
      exists (
        select 1 from whatsapp_messages i
        where i.tenant_id = l.tenant_id and i.lead_id = l.id and i.direction in ('incoming', 'inbound')
          and i.sent_at > x.first_sent_at
      ) as replied,
      l.qualification_status, l.status
    from touched x
    join leads l on l.id = x.lead_id and l.tenant_id = ${tenantId}
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    sent: number; skipped: number; stop_reason: string | null; cadence_active: boolean; replied: boolean; qualification_status: string | null; status: string;
  }>;
  return summarizeFollowupStats(rows.map((row): FollowupStatRow => ({
    sent: Number(row.sent) || 0,
    skipped: Number(row.skipped) || 0,
    stopReason: row.stop_reason,
    cadenceActive: Boolean(row.cadence_active),
    replied: Boolean(row.replied),
    qualificationStatus: row.qualification_status,
    status: row.status,
  })));
}
