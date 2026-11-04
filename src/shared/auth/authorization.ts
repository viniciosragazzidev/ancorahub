import "server-only";

import { AuthorizationError } from "./errors";
import type { PermissionKey } from "./permissions";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import type { TenantContext } from "./types";
import type { TenantRole } from "@/shared/db/schema";

export function requireRole(
  context: TenantContext,
  role: TenantRole,
): TenantContext {
  if (context.role !== role) {
    throw new AuthorizationError("The current role is not authorized.");
  }

  return context;
}

export function requireAnyRole(
  context: TenantContext,
  roles: readonly TenantRole[],
): TenantContext {
  if (!roles.includes(context.role)) {
    throw new AuthorizationError("The current role is not authorized.");
  }

  return context;
}

export async function requireCapability(
  context: TenantContext,
  permission: PermissionKey,
): Promise<TenantContext> {
  if (!(await hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null, permission }))) {
    throw new AuthorizationError("The current profile does not have this capability.");
  }

  return context;
}

/**
 * Cargos (04/11, F2): checa a capacidade só para quem tem cargo. Sem cargo não faz nada, então a regra de
 * hoje (papel) continua igual; com cargo vale papel ∩ cargo. Use em ações que hoje checam o papel cru.
 */
export async function requireCargoCapability(
  context: Pick<TenantContext, "tenantId" | "role" | "jobTitle" | "customRoleId">,
  permission: PermissionKey,
): Promise<void> {
  if (!context.customRoleId) return;
  if (!(await hasEffectiveCapability({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId, permission }))) {
    throw new AuthorizationError("Seu cargo não libera esta ação.");
  }
}

export function assertTenantAccess(
  context: TenantContext,
  resourceTenantId: string,
): void {
  if (context.tenantId !== resourceTenantId) {
    throw new AuthorizationError("Cross-tenant access is not allowed.");
  }
}

export function assertBranchAccess(
  context: TenantContext,
  resource: { tenantId: string; branchId: string },
): void {
  assertTenantAccess(context, resource.tenantId);

  if (context.role === "director") {
    return;
  }

  if (!context.branchId || context.branchId !== resource.branchId) {
    throw new AuthorizationError("Cross-branch access is not allowed.");
  }
}
