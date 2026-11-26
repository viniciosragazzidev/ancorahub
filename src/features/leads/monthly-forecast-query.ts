import "server-only";

import { and, inArray, isNull, sql, type SQL } from "drizzle-orm";

import type { AccessContext } from "@/shared/auth/access-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";

import { buildLeadScopeWhere } from "./lead-authorization";
import {
  FORECAST_STATUSES,
  computeMonthlyForecast,
  forecastChancesKey,
  parseForecastChances,
  type ForecastChances,
  type MonthlyForecast,
} from "./monthly-forecast";

/**
 * Leads que entram na previsão: o escopo de sempre (diretor empresa, gestor unidade, supervisor equipe, corretor o
 * seu, via buildLeadScopeWhere), sem excluídos e arquivados, só nas etapas abertas do funil.
 */
export function forecastLeadWhere(context: AccessContext | TenantContext, requestedBranchId?: string | null): SQL {
  return and(
    buildLeadScopeWhere(context, { requestedBranchId: requestedBranchId ?? null }),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    inArray(schema.leads.status, FORECAST_STATUSES as (typeof schema.leadStatusValues)[number][]),
  )!;
}

export async function getForecastChances(tenantId: string): Promise<ForecastChances> {
  return parseForecastChances(await getSystemSetting(forecastChancesKey(tenantId)));
}

export type MonthlyForecastData = MonthlyForecast & { chances: ForecastChances };

export async function getMonthlyForecast(context: TenantContext, requestedBranchId?: string | null): Promise<MonthlyForecastData> {
  // Mesmo valor do cartão: proposta aberta mais recente e, sem ela, o valor do lead (cotação ou manual).
  const value = sql`coalesce((select ${schema.proposals.totalMonthly} from ${schema.proposals} where ${schema.proposals.tenantId} = ${schema.leads.tenantId} and ${schema.proposals.leadId} = ${schema.leads.id} and ${schema.proposals.status} in ('rascunho', 'em_revisao', 'enviada', 'visualizada', 'negociacao', 'aprovada') order by ${schema.proposals.createdAt} desc limit 1), ${schema.leads.monthlyValue})`;
  const positive = sql`case when ${value} > 0 then ${value} end`;
  const [rows, chances] = await Promise.all([
    getDatabase()
      .select({
        status: schema.leads.status,
        total: sql<number>`count(*)::int`,
        withValue: sql<number>`count(${positive})::int`,
        grossCents: sql<string>`coalesce(sum(round(${positive} * 100)), 0)::bigint`,
      })
      .from(schema.leads)
      .where(forecastLeadWhere(context, requestedBranchId))
      .groupBy(schema.leads.status),
    getForecastChances(context.tenantId),
  ]);
  const forecast = computeMonthlyForecast(
    rows.map((row) => ({ status: row.status, total: Number(row.total), withValue: Number(row.withValue), grossCents: Number(row.grossCents) })),
    chances,
  );
  return { ...forecast, chances };
}
