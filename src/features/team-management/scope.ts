import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { isSupervisorTeamScoped } from "@/features/team/supervisor-scope-policy";
import type { TenantContext } from "@/shared/auth/types";

export type TeamMetricsScope =
  | { readonly kind: "unit"; readonly tenantId: string; readonly branchId: string }
  | { readonly kind: "team"; readonly tenantId: string; readonly supervisorId: string };

/** Resolve a metrics boundary exclusively from the authenticated server context. */
export function resolveTeamMetricsScope(context: TenantContext): TeamMetricsScope {
  if (context.role === "manager") {
    const unit = getManagerUnitScope(context);
    if (!unit) throw new Error("A unidade do gestor não está disponível neste escopo.");
    return { kind: "unit", tenantId: unit.tenantId, branchId: unit.branchId };
  }

  if (context.role === "supervisor" && isSupervisorTeamScoped(context)) {
    return { kind: "team", tenantId: context.tenantId, supervisorId: context.userId };
  }

  throw new Error("As métricas de equipe estão disponíveis apenas para gestor da unidade ou supervisor da própria equipe.");
}

/** The broker's own boundary: one person, never a team or unit aggregate. */
export type BrokerMetricsScope = { readonly kind: "broker"; readonly tenantId: string; readonly brokerId: string };

export type CanonicalMetricsScope = TeamMetricsScope | BrokerMetricsScope;

/** Resolve the broker's own metrics boundary from the authenticated server context only. */
export function resolveBrokerMetricsScope(context: TenantContext): BrokerMetricsScope {
  if (context.role !== "broker") throw new Error("As métricas pessoais estão disponíveis apenas para o próprio corretor.");
  return { kind: "broker", tenantId: context.tenantId, brokerId: context.userId };
}

/** A broker scope only ever returns the broker's own row. */
export function isBrokerMetricRowVisibleInScope(
  scope: BrokerMetricsScope,
  row: { readonly tenantId: string; readonly scopeType: "broker" | "team" | "unit"; readonly brokerId: string | null },
): boolean {
  return row.tenantId === scope.tenantId && row.scopeType === "broker" && row.brokerId === scope.brokerId;
}

/** Pure membership check used by scope tests and by server-side result shaping. */
export function isBrokerVisibleInTeamMetricsScope(
  scope: TeamMetricsScope,
  broker: { readonly tenantId: string; readonly branchId: string | null; readonly supervisorId: string | null },
): boolean {
  if (broker.tenantId !== scope.tenantId) return false;
  return scope.kind === "unit"
    ? broker.branchId === scope.branchId
    : broker.supervisorId === scope.supervisorId;
}

export function isTeamMetricRowVisibleInScope(
  scope: TeamMetricsScope,
  row: {
    readonly tenantId: string;
    readonly scopeType: "broker" | "team" | "unit";
    readonly branchId: string | null;
    readonly supervisorId: string | null;
  },
): boolean {
  if (row.tenantId !== scope.tenantId) return false;
  if (scope.kind === "unit") return row.branchId === scope.branchId;
  if (row.scopeType === "unit") return false;
  return row.supervisorId === scope.supervisorId;
}
