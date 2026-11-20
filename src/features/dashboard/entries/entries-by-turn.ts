import "server-only";

import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { businessDaysBack, businessTurnStart } from "../essential/business-window";
import type { OverviewPeriod } from "../overview-filter";
import { bucketEntriesByTurn, type EntriesByTurn, type EntryChannel } from "./entries-by-turn-core";

const PERIOD_DAYS: Record<OverviewPeriod, number> = { today: 1, "7d": 7, "30d": 30 };

/** Canal de entrada em SQL: WhatsApp (canal próprio ou anúncio que entrou pelo WhatsApp), formulário, ou outros (manual e importação). */
const channelSql = sql<EntryChannel>`case
  when ${schema.leads.sourceChannel} in ('whatsapp', 'whatsapp_ctwa')
    or (${schema.leads.sourceChannel} = 'meta_lead_ads' and ${schema.leads.sourceMetadata}->>'entry' = 'whatsapp') then 'whatsapp'
  when ${schema.leads.sourceChannel} = 'bulk_import' or ${schema.leads.origem} = 'manual' then 'other'
  else 'form' end`;

/**
 * Entradas por turno no período, por canal. Uma consulta agregada por hora (no máximo ~720 linhas em 30 dias);
 * a soma por turno é feita em `bucketEntriesByTurn`. Respeita o escopo de relatório do usuário e a fila escolhida.
 */
export async function getEntriesByTurn(
  context: TenantContext,
  filter: { period: OverviewPeriod; queueId?: string | null },
  now = new Date(),
): Promise<EntriesByTurn> {
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const daysBack = businessDaysBack(PERIOD_DAYS[filter.period]);
  const turnStarts: Date[] = [];
  for (let step = 0; step <= daysBack; step += 1) {
    const start = businessTurnStart(now, step);
    if (!turnStarts.some((known) => known.getTime() === start.getTime())) turnStarts.push(start);
  }
  const since = turnStarts[turnStarts.length - 1] ?? businessTurnStart(now, 0);
  const hour = sql<Date>`date_trunc('hour', ${schema.leads.createdAt})`;
  const rows = await db
    .select({ hour, channel: channelSql, total: sql<number>`count(*)::int` })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      scope.leadScope,
      filter.queueId ? eq(schema.leads.queueId, filter.queueId) : undefined,
      gte(schema.leads.createdAt, since),
      lte(schema.leads.createdAt, now),
    ))
    .groupBy(hour, channelSql);
  return bucketEntriesByTurn(
    rows.map((row) => ({ hour: new Date(row.hour), channel: row.channel, total: Number(row.total) })),
    turnStarts,
    (date) => businessTurnStart(date, 0),
  );
}
