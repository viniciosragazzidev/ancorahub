import "server-only";

import { AuthorizationError } from "./errors";
import { hasCapability, type PermissionKey } from "./permissions";
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

export function requireCapability(
  context: TenantContext,
  permission: PermissionKey,
): TenantContext {
  if (!hasCapability(context.role, permission, context.jobTitle)) {
    throw new AuthorizationError("The current profile does not have this capability.");
  }

  return context;
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
