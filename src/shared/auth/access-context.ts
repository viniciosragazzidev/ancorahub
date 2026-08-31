import "server-only";

import type { PermissionKey } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "./tenant-context";
import type { TenantContext } from "./types";
import { listEffectiveCapabilities } from "@/features/custom-roles/service";
import { withPerfSpan } from "@/shared/observability/request-timing";

export type AccessScopeType = "GLOBAL" | "UNITS" | "SELF" | "NONE";

export type AccessContext = TenantContext & {
  permissions: Set<PermissionKey>;
  scopeType: AccessScopeType;
  allowedUnitIds: string[];
  canAccessAllUnits: boolean;
};

export async function resolveAccessContext(
  existingContext?: TenantContext,
): Promise<AccessContext> {
  return withPerfSpan("access_context.resolve", async () => {
    const context = existingContext ?? (await getRequiredTenantContext());

    const permissionList = await withPerfSpan("rbac.resolve", () => listEffectiveCapabilities({
      tenantId: context.tenantId,
      role: context.role,
      jobTitle: context.jobTitle,
      customRoleId: context.customRoleId ?? null,
    }));

  const permissions = new Set<PermissionKey>(permissionList);

  let scopeType: AccessScopeType = "GLOBAL";
  let allowedUnitIds: string[] = [];
  let canAccessAllUnits = false;

  if (context.role === "director" || context.customRoleScope === "tenant") {
    scopeType = "GLOBAL";
    canAccessAllUnits = true;
  } else if (context.customRoleScope === "none") {
    scopeType = "NONE";
  } else if (context.role === "broker" && (!context.customRoleScope || context.customRoleScope === "own")) {
    scopeType = "SELF";
    if (context.branchId) allowedUnitIds = [context.branchId];
  } else {
    // Escopo por unidade / filiais (manager, supervisor, ou customRoleScope = branch)
    scopeType = "UNITS";
    if (context.branchId) {
      allowedUnitIds = [context.branchId];
    }
  }

    return {
      ...context,
      permissions,
      scopeType,
      allowedUnitIds,
      canAccessAllUnits,
    };
  });
}
