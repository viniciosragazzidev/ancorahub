import type { TenantContext } from "@/shared/auth/types";

export type ErpScope = { mode: "tenant" } | { mode: "units"; unitIds: readonly string[] } | { mode: "owners"; ownerIds: readonly string[]; unitIds?: readonly string[] } | { mode: "none" };

/** Role ceiling intersected with the trusted cargo boundary; client filters never widen it. */
export function resolveErpScope(input: {
  context: TenantContext; financial: boolean; supervisedIds: readonly string[];
  cargo: { tenantWide: boolean; ownership: "ANY" | "SCOPED" | "SELF" | "NONE"; unitIds: readonly string[] };
}): ErpScope {
  const { context, cargo } = input;
  const owners = (ownerIds: readonly string[]): ErpScope => {
    if (!ownerIds.length) return { mode: "none" };
    if (context.customRoleId && context.customRoleScope === "branch") return cargo.unitIds.length ? { mode: "owners", ownerIds, unitIds: cargo.unitIds } : { mode: "none" };
    return { mode: "owners", ownerIds };
  };
  if (cargo.ownership === "NONE" || context.customRoleScope === "none") return { mode: "none" };
  if (cargo.ownership === "SELF") return owners([context.userId]);
  if (context.role === "supervisor") {
    if (input.financial) return owners([context.userId]);
    return owners(input.supervisedIds);
  }
  if (context.role === "director") {
    if (cargo.tenantWide) return { mode: "tenant" };
    return cargo.unitIds.length ? { mode: "units", unitIds: cargo.unitIds } : { mode: "none" };
  }
  const delegatedFunction = (input.financial && context.jobTitle === "finance") || (!input.financial && context.jobTitle === "operations");
  if (delegatedFunction && context.customRoleId && (context.role === "manager" || context.role === "broker")) {
    if (context.customRoleScope === "tenant" && cargo.tenantWide) return { mode: "tenant" };
    if (context.customRoleScope === "branch" && cargo.unitIds.length) return { mode: "units", unitIds: cargo.unitIds };
  }
  if (context.role === "manager") {
    if (!context.branchId || (!cargo.tenantWide && !cargo.unitIds.includes(context.branchId))) return { mode: "none" };
    return { mode: "units", unitIds: [context.branchId] };
  }
  if (context.role === "broker") {
    return owners([context.userId]);
  }
  return { mode: "none" };
}

export function scopeIncludes(scope: ErpScope, record: { branchId: string | null; ownerId: string | null }) {
  if (scope.mode === "tenant") return true;
  if (scope.mode === "units") return record.branchId !== null && scope.unitIds.includes(record.branchId);
  return scope.mode === "owners" && record.ownerId !== null && scope.ownerIds.includes(record.ownerId) && (!scope.unitIds || (record.branchId !== null && scope.unitIds.includes(record.branchId)));
}
