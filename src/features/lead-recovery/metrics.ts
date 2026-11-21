import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

import {
  isRecovered,
  recoveryNumbers,
  recoverySteps,
  recoveryWeeks,
  type RecoveryFunnelData,
  type RecoveryHealth,
  type RecoveryLeadRow,
  type RecoveryTouchRow,
} from "./metrics-core";
import { getRecoverySettings } from "./settings";
import { META_COST_BRL } from "./touch-cost";

const WEEKS = 8;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

function iso(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Linhas por lead de anúncio das últimas 8 semanas (sem nome nem telefone): estado, se entrou na recuperação e
 * quando, e se respondeu depois. A entrada é o primeiro destes: virou frio por tempo (auditoria), lembrete do
 * turbo enviado, follow-up de silêncio enviado.
 */
async function loadLeadRows(tenantId: string, since: Date, queueId: string | null): Promise<RecoveryLeadRow[]> {
  const result = await getDatabase().execute(sql`
    with base as (
      select l.id, l.created_at, l.qualification_status, l.status::text as status, l.corretor_id, l.tenant_id,
        l.qualification_details->'turbo' as turbo, l.qualification_details->'recovery' as recovery
      from leads l
      where l.tenant_id = ${tenantId} and l.deleted_at is null and l.source_channel = 'meta_lead_ads'
        and l.created_at >= ${since.toISOString()}::timestamptz
        ${queueId ? sql`and l.queue_id = ${queueId}` : sql``}
    ),
    entry as (
      select b.id,
        least(
          (select min(a.created_at) from audit_logs a where a.entidade = 'lead' and a.entidade_id = b.id and a.acao like 'qualification.timeout%'),
          (select min((t->>'at')::timestamptz) from jsonb_array_elements(coalesce(b.turbo->'touches', '[]'::jsonb)) t
            where t->>'touch' in ('t1', 't2', 't3', 't4') and t->>'status' = 'sent'),
          (select min(m.sent_at) from whatsapp_messages m where m.tenant_id = b.tenant_id and m.lead_id = b.id
            and m.id like 'ai\\_silence\\_followup\\_%' and m.provider_status = 'sent')
        ) as entered_at
      from base b
    )
    select b.id, b.created_at, b.qualification_status, b.status, b.corretor_id is not null as has_broker,
      b.recovery->>'state' as recovery_state,
      (b.turbo->>'firstContactAt') is not null and (b.turbo->>'stoppedAt') is null as cadence_active,
      e.entered_at,
      exists (select 1 from whatsapp_messages i where i.tenant_id = b.tenant_id and i.lead_id = b.id and i.direction in ('incoming', 'inbound')) as replied,
      e.entered_at is not null and exists (select 1 from whatsapp_messages i where i.tenant_id = b.tenant_id and i.lead_id = b.id
        and i.direction in ('incoming', 'inbound') and i.sent_at > e.entered_at) as replied_after,
      exists (select 1 from ai_conversations c where c.tenant_id = b.tenant_id and c.lead_id = b.id
        and (c.opt_out_at is not null or c.wrong_number_at is not null)) or b.recovery->>'state' = 'do_not_contact' as do_not_contact
    from base b join entry e on e.id = b.id
  `);
  return rowsOf<Record<string, unknown>>(result).map((row) => ({
    leadId: String(row.id),
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    qualificationStatus: (row.qualification_status as string | null) ?? null,
    status: String(row.status),
    hasBroker: Boolean(row.has_broker),
    replied: Boolean(row.replied),
    recoveryState: (row.recovery_state as string | null) ?? null,
    doNotContact: Boolean(row.do_not_contact),
    cadenceActive: Boolean(row.cadence_active),
    enteredAt: iso(row.entered_at),
    repliedAfterEntry: Boolean(row.replied_after),
  }));
}

/** Toques do período: lembretes do turbo (T1–T4) e follow-up de silêncio (S1), lidos de onde já existem. */
async function loadLegacyTouches(tenantId: string, since: Date, queueId: string | null): Promise<RecoveryTouchRow[]> {
  const result = await getDatabase().execute(sql`
    with touches as (
      select l.id as lead_id, l.tenant_id, t->>'touch' as step, t->>'status' as status, t->>'errorCode' as reason, (t->>'at')::timestamptz as at
      from leads l
      cross join lateral jsonb_array_elements(coalesce(l.qualification_details->'turbo'->'touches', '[]'::jsonb)) t
      where l.tenant_id = ${tenantId} and l.deleted_at is null and l.source_channel = 'meta_lead_ads'
        and l.created_at >= ${new Date(since.getTime() - 7 * 86_400_000).toISOString()}::timestamptz
        ${queueId ? sql`and l.queue_id = ${queueId}` : sql``}
        and t->>'touch' in ('t1', 't2', 't3', 't4') and (t->>'at')::timestamptz >= ${since.toISOString()}::timestamptz
      union all
      select m.lead_id, m.tenant_id, 's1', case when m.provider_status = 'sent' then 'sent' else 'failed' end, null, m.sent_at
      from whatsapp_messages m join leads l on l.id = m.lead_id and l.tenant_id = m.tenant_id
      where m.tenant_id = ${tenantId} and m.id like 'ai\\_silence\\_followup\\_%' and m.sent_at >= ${since.toISOString()}::timestamptz
        and l.source_channel = 'meta_lead_ads'
        ${queueId ? sql`and l.queue_id = ${queueId}` : sql``}
    )
    select x.lead_id, x.step, x.status, x.reason, x.at,
      x.status = 'sent' and exists (select 1 from whatsapp_messages i where i.tenant_id = x.tenant_id and i.lead_id = x.lead_id
        and i.direction in ('incoming', 'inbound') and i.sent_at > x.at and i.sent_at < x.at + interval '24 hours') as replied
    from touches x
  `);
  return rowsOf<Record<string, unknown>>(result).map((row) => {
    const step = String(row.step);
    return {
      leadId: String(row.lead_id),
      step,
      status: String(row.status ?? "failed"),
      reason: (row.reason as string | null) ?? null,
      at: iso(row.at) ?? new Date(0).toISOString(),
      replied: Boolean(row.replied),
      costBrl: row.status === "sent" ? (step === "t1" ? META_COST_BRL.utility : step === "s1" ? 0 : META_COST_BRL.marketing) : 0,
    };
  });
}

/** Toques novos (cadência única, ligação, nutrição) da tabela 0234. Null quando a migration ainda não rodou. */
async function loadRecoveryTouches(tenantId: string, since: Date, queueId: string | null): Promise<RecoveryTouchRow[] | null> {
  try {
    const result = await getDatabase().execute(sql`
      select r.lead_id, r.step, r.status, r.reason, r.created_at as at, r.cost_brl,
        r.status = 'sent' and exists (select 1 from whatsapp_messages i where i.tenant_id = r.tenant_id and i.lead_id = r.lead_id
          and i.direction in ('incoming', 'inbound') and i.sent_at > r.created_at and i.sent_at < r.created_at + interval '24 hours') as replied
      from lead_recovery_touches r join leads l on l.id = r.lead_id and l.tenant_id = r.tenant_id
      where r.tenant_id = ${tenantId} and r.created_at >= ${since.toISOString()}::timestamptz
        and r.step not in ('t1', 't2', 't3', 't4', 's1')
        and l.source_channel = 'meta_lead_ads'
        ${queueId ? sql`and l.queue_id = ${queueId}` : sql``}
    `);
    return rowsOf<Record<string, unknown>>(result).map((row) => ({
      leadId: String(row.lead_id),
      step: String(row.step),
      status: String(row.status),
      reason: (row.reason as string | null) ?? null,
      at: iso(row.at) ?? new Date(0).toISOString(),
      replied: Boolean(row.replied),
      costBrl: Number(row.cost_brl) || 0,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/lead_recovery_touches/.test(message)) return null;
    throw error;
  }
}

async function loadHealth(tenantId: string, since: Date, sends: number): Promise<Omit<RecoveryHealth, "templatesNotApproved">> {
  const result = await getDatabase().execute(sql`
    select
      (select count(*)::int from ai_conversations c join leads l on l.id = c.lead_id and l.tenant_id = c.tenant_id
        where c.tenant_id = ${tenantId} and c.opt_out_at >= ${since.toISOString()}::timestamptz and l.source_channel = 'meta_lead_ads') as opt_outs,
      (select count(*)::int from whatsapp_outbound_messages o
        where o.tenant_id = ${tenantId} and o.provider_error_code = '131049' and o.created_at >= ${since.toISOString()}::timestamptz) as limit_131049
  `);
  const row = rowsOf<{ opt_outs: number; limit_131049: number }>(result)[0];
  return { sends, optOuts: Number(row?.opt_outs) || 0, limit131049: Number(row?.limit_131049) || 0 };
}

/**
 * Tudo o que /qualificacao/recuperacao mostra. `since` é o início do período escolhido (números e passos); a
 * série semanal sempre cobre 8 semanas.
 */
export async function getRecoveryFunnel(input: {
  tenantId: string;
  since: Date;
  queueId: string | null;
  periodText: string;
  queueName: string | null;
  templatesNotApproved: RecoveryHealth["templatesNotApproved"];
  now?: Date;
}): Promise<RecoveryFunnelData> {
  const now = input.now ?? new Date();
  const weeksSince = new Date(now.getTime() - WEEKS * 7 * 86_400_000);
  const [settings, leadRows, legacy, recorded] = await Promise.all([
    getRecoverySettings(input.tenantId),
    loadLeadRows(input.tenantId, weeksSince < input.since ? weeksSince : input.since, input.queueId),
    loadLegacyTouches(input.tenantId, input.since, input.queueId),
    loadRecoveryTouches(input.tenantId, input.since, input.queueId),
  ]);
  const inPeriod = leadRows.filter((row) => row.createdAt >= input.since.toISOString());
  const recoveredLeads = new Set(leadRows.filter(isRecovered).map((row) => row.leadId));
  const touches = [...legacy, ...(recorded ?? [])];
  const sends = touches.filter((touch) => touch.status === "sent").length;
  const health = await loadHealth(input.tenantId, input.since, sends);
  return {
    periodText: input.periodText,
    queueName: input.queueName,
    controlPct: settings.controlPct,
    recoveryEnabled: settings.enabled,
    touchesTableMissing: recorded === null,
    numbers: recoveryNumbers(inPeriod),
    steps: recoverySteps(touches, recoveredLeads),
    weeks: recoveryWeeks(leadRows, settings.controlPct, WEEKS, now),
    health: { ...health, templatesNotApproved: input.templatesNotApproved },
  };
}
