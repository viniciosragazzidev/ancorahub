import type { TenantContext } from "@/shared/auth/types";

/** A manager Lite scope always needs its authenticated unit; missing is empty, never tenant-wide. */
export function getManagerUnitScope(context: TenantContext) {
  if (context.role !== "manager" || !context.branchId) return null;
  return { tenantId: context.tenantId, branchId: context.branchId };
}
