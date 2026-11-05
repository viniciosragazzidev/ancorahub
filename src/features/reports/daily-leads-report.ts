import "server-only";

import { sql } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getNoticeRecipients } from "@/features/leads/closing-director-alert";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { getTeamNoticeSetting } from "@/features/team-notices/service";
import { getDatabase } from "@/shared/db";

import {
  buildDailyLeadsReport,
  DAILY_LEADS_REPORT_HOUR,
  DAILY_LEADS_REPORT_NOTICE_KEY,
  DAILY_LEADS_REPORT_PURPOSE,
  dailyLeadsReportKey,
  saoPauloDayKey,
  saoPauloDayStart,
  saoPauloHour,
  shortDate,
  type QueueDayRow,
} from "./daily-leads-report-core";

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

/** Leads que entraram hoje (São Paulo) em cada fila da empresa, com quentes, mornos e frios. */
export async function loadQueueDayRows(tenantId: string, now: Date): Promise<QueueDayRow[]> {
  const since = saoPauloDayStart(now).toISOString();
  const result = await getDatabase().execute(sql`
    select q.name as queue_name,
      count(*)::int as leads,
      count(*) filter (where l.qualification_status = 'hot')::int as hot,
      count(*) filter (where l.qualification_status = 'warm')::int as warm,
      count(*) filter (where l.qualification_status = 'cold')::int as cold
    from leads l
    left join lead_queues q on q.id = l.queue_id and q.tenant_id = l.tenant_id
    where l.tenant_id = ${tenantId} and l.created_at >= ${since}::timestamptz and l.deleted_at is null
    group by q.name
  `);
  return rowsOf<{ queue_name: string | null; leads: number; hot: number; warm: number; cold: number }>(result)
    .map((row) => ({ queueName: row.queue_name, leads: Number(row.leads), hot: Number(row.hot), warm: Number(row.warm), cold: Number(row.cold) }));
}

/** Uma empresa: monta o texto e põe na fila de envio para cada número (uma vez por dia e número). */
export async function sendDailyLeadsReport(tenantId: string, now = new Date()) {
  const notice = teamNoticeByKey(DAILY_LEADS_REPORT_NOTICE_KEY);
  if (!notice || !(await getTeamNoticeSetting(tenantId, notice)).enabled) return { tenantId, sent: 0, reason: "disabled" as const };
  const recipients = await getNoticeRecipients(tenantId, DAILY_LEADS_REPORT_NOTICE_KEY);
  if (!recipients.length) return { tenantId, sent: 0, reason: "no_recipients" as const };
  const report = buildDailyLeadsReport(await loadQueueDayRows(tenantId, now));
  const dayKey = saoPauloDayKey(now);
  const settled = await Promise.allSettled(recipients.map((phone) => enqueueMetaTemplateMessage({
    tenantId,
    recipientType: "user",
    destinationPhone: phone,
    purpose: DAILY_LEADS_REPORT_PURPOSE,
    variables: [shortDate(now), report],
    requestedBy: null,
    idempotencyKey: dailyLeadsReportKey(tenantId, dayKey, phone),
  }).then((queued) => (queued.duplicate || (queued.status as string) === "skipped"
    ? false
    : processMetaOutboundBatch(1, tenantId, queued.id).then(() => true)))));
  let sent = 0;
  for (const item of settled) {
    if (item.status === "fulfilled" && item.value) sent += 1;
    if (item.status === "rejected") console.warn("[daily-leads-report] send_failed", { tenantId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
  }
  return { tenantId, sent, reason: "ok" as const };
}

/** Job das 18h (Coolify, 21:00 UTC): todas as empresas com o aviso ligado. Antes das 18h de SP não envia. */
export async function runDailyLeadsReportJob(now = new Date()) {
  if (saoPauloHour(now) < DAILY_LEADS_REPORT_HOUR) return { skipped: true as const, reason: "before_18h" };
  const tenants = rowsOf<{ id: string }>(await getDatabase().execute(sql`select id from tenants`));
  const results = [];
  for (const tenant of tenants) {
    try {
      results.push(await sendDailyLeadsReport(tenant.id, now));
    } catch (error) {
      console.error("[daily-leads-report] tenant_failed", { tenantId: tenant.id, error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200) });
    }
  }
  return { skipped: false as const, results };
}
