import "server-only";

import { asc, eq } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { resolveAccessContext } from "@/shared/auth/access-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type DashboardUnit = { id: string; name: string };

/** Unidades que o viewer pode escolher, pela mesma regra de escopo dos relatórios. */
export function unitsInScope(all: DashboardUnit[], access: { canAccessAllUnits: boolean; allowedUnitIds: string[] } | null): DashboardUnit[] {
  if (!access || access.canAccessAllUnits) return all;
  return all.filter((unit) => access.allowedUnitIds.includes(unit.id));
}

/** `?unidade=` só vale se estiver entre as unidades permitidas; fora disso, cai em "Todas" (null). */
export function resolveRequestedUnit(requested: string | null, units: DashboardUnit[]): string | null {
  return requested && units.some((unit) => unit.id === requested) ? requested : null;
}

/**
 * Filtro de unidade do painel. `canCompare` é a permissão de comparar unidades (sem ela o filtro some);
 * `units` são só as unidades autorizadas. Nunca lê unidades de outra empresa.
 */
export async function getDashboardUnitFilter(context: TenantContext): Promise<{ canCompare: boolean; units: DashboardUnit[] }> {
  const [scope, all, access] = await Promise.all([
    resolveReportDataScope(context),
    getDatabase()
      .select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(eq(schema.branches.tenantId, context.tenantId))
      .orderBy(asc(schema.branches.name)),
    context.customRoleId ? resolveAccessContext(context) : Promise.resolve(null),
  ]);
  if (!scope.canCompareUnits) return { canCompare: false, units: [] };
  return { canCompare: true, units: unitsInScope(all, access) };
}
