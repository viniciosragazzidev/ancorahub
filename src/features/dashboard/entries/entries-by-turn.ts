import "server-only";

import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { leadQualityWindow, type LeadQualityPeriod } from "@/features/reports/metrics/lead-quality-period";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { businessDaysBack, businessTurnStart } from "../essential/business-window";
import type { OverviewPeriod } from "../overview-filter";
import { bucketEntriesByTurn, type EntriesByTurn, type EntryChannel, type EntryShift } from "./entries-by-turn-core";

const PERIOD_DAYS: Record<OverviewPeriod, number> = { today: 1, "7d": 7, "30d": 30 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Canal de entrada em SQL: WhatsApp (canal próprio ou anúncio que entrou pelo WhatsApp), formulário, ou outros (manual e importação). */
const channelSql = sql<EntryChannel>`case
  when ${schema.leads.sourceChannel} in ('whatsapp', 'whatsapp_ctwa')
    or (${schema.leads.sourceChannel} = 'meta_lead_ads' and ${schema.leads.sourceMetadata}->>'entry' = 'whatsapp') then 'whatsapp'
  when ${schema.leads.sourceChannel} = 'bulk_import' or ${schema.leads.origem} = 'manual' then 'other'
  else 'form' end`;

/** Turno pela hora de São Paulo: Turno 2 das 13h30 às 19h, Turno 1 no resto (19h às 13h30). */
const shiftSql = sql<number>`case
  when (${schema.leads.createdAt} at time zone 'America/Sao_Paulo')::time >= time '13:30'
   and (${schema.leads.createdAt} at time zone 'America/Sao_Paulo')::time < time '19:00' then 2
  else 1 end`;

/** Janela do filtro: um dos atalhos (hoje, 7, 30 dias) ou um intervalo personalizado com data e hora. */
export type EntriesWindow = { period: OverviewPeriod } | { range: LeadQualityPeriod };

function resolveWindow(window: EntriesWindow, now: Date): { since: Date; until: Date } {
  if ("range" in window) {
    const bounds = leadQualityWindow(window.range, now);
    return { since: bounds.since, until: bounds.until ?? now };
  }
  return { since: businessTurnStart(now, businessDaysBack(PERIOD_DAYS[window.period])), until: now };
}

/**
 * Entradas por dia de operação e por turno, no período, separadas por canal. Uma consulta agregada por hora
 * (o turno já vem calculado em SQL, então 13h às 13h59 se divide certo); a soma por dia fica em `bucketEntriesByTurn`.
 * Respeita o escopo de relatório do usuário e a fila escolhida.
 */
export async function getEntriesByTurn(
  context: TenantContext,
  filter: EntriesWindow & { queueId?: string | null },
  now = new Date(),
): Promise<EntriesByTurn> {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const { since, until } = resolveWindow(filter, now);
  // Dias de operação cobertos pela janela, do último para o primeiro (sem repetir o de sexta que cobre o fim de semana).
  const dayStarts: Date[] = [];
  let cursor = businessTurnStart(new Date(Math.max(since.getTime(), until.getTime() - 1)), 0);
  const first = businessTurnStart(since, 0);
  while (cursor.getTime() >= first.getTime() && dayStarts.length < 400) {
    if (!dayStarts.some((known) => known.getTime() === cursor.getTime())) dayStarts.push(cursor);
    cursor = businessTurnStart(new Date(cursor.getTime() - DAY_MS / 2), 0);
  }
  const hour = sql<Date>`date_trunc('hour', ${schema.leads.createdAt})`;
  const rows = await db
    .select({ hour, shift: shiftSql, channel: channelSql, total: sql<number>`count(*)::int` })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      scope.leadScope,
      filter.queueId ? eq(schema.leads.queueId, filter.queueId) : undefined,
      gte(schema.leads.createdAt, since),
      lt(schema.leads.createdAt, until),
    ))
    .groupBy(hour, shiftSql, channelSql);
  return bucketEntriesByTurn(
    rows.map((row) => ({ hour: new Date(row.hour), shift: (Number(row.shift) === 2 ? 2 : 1) as EntryShift, channel: row.channel, total: Number(row.total) })),
    dayStarts,
    (date) => businessTurnStart(date, 0),
  );
}
