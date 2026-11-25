import "server-only";

import { and, count, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import type { NavCounts } from "@/shared/navigation/nav-counters";

/** Mesmos estados de "esperando corretor" do painel (src/features/dashboard/today.ts). */
const WAITING_STATES = ["queued", "unassigned", "returned_to_queue"] as const;

/**
 * Contadores do menu do diretor (25/11/2026, docs/research/deskcomm-crm-engenharia-reversa.md, item 2):
 * as mesmas regras do painel "Hoje", só as duas contagens que pedem ação. O escopo é o do relatório
 * (diretor: empresa; gestor: unidade; supervisor: equipe), e o corretor não tem contador.
 */
export async function getNavCounts(context: TenantContext): Promise<NavCounts> {
  if (context.role === "broker") return {};
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const alive = and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    scope.leadScope,
  );
  const [[waiting], [withoutFirstContact]] = await Promise.all([
    db.select({ value: count() }).from(schema.leads).where(and(alive, isNull(schema.leads.corretorId), inArray(schema.leads.distributionStatus, [...WAITING_STATES]))),
    db.select({ value: count() }).from(schema.leads).where(and(alive, isNotNull(schema.leads.corretorId), inArray(schema.leads.status, ["new", "distributed"]), isNull(schema.leads.serviceStartedAt))),
  ]);
  return {
    leads: Number(withoutFirstContact?.value ?? 0),
    distribuicao: Number(waiting?.value ?? 0),
  };
}
