import "server-only";

import { hasCapability } from "@/shared/auth/permissions";
import type { TenantContext } from "@/shared/auth/types";
import type { PeriodValue } from "@/shared/period";
import {
  getAttentionSnapshot,
  getCommercialOverview,
  getFunnelSnapshot,
  getLeadTimeline,
  getTeamPerformance,
  getUnitPerformance,
} from "@/features/reports/metrics/metrics-service";

/**
 * Adaptador de leitura do painel executivo.
 *
 * Não contém queries: só compõe os resolvedores canônicos da Central de
 * Relatórios, que já derivam tenant, papel e unidade da sessão.
 */
export async function getExecutiveDashboardData(
  context: TenantContext,
  period: PeriodValue,
) {
  const includeFinancial = hasCapability(
    context.role,
    "ver_relatorios_financeiros",
    context.jobTitle,
  );

  const [commercial, funnel, attention, units, team, timeline] = await Promise.all([
    getCommercialOverview(context, period, { includeFinancial }),
    getFunnelSnapshot(context, period),
    getAttentionSnapshot(context, period),
    getUnitPerformance(context, period),
    getTeamPerformance(context, period, { includeFinancial }),
    getLeadTimeline(context, period),
  ]);

  return { commercial, funnel, attention, units, team, timeline, includeFinancial };
}

export type ExecutiveDashboardData = Awaited<ReturnType<typeof getExecutiveDashboardData>>;
