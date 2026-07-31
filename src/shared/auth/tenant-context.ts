import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { TenantContext } from "./types";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { getSuperAdminRoleOverride } from "@/features/super-admin/role-impersonation";

export type { TenantContext };

export async function getRequiredTenantContext(): Promise<TenantContext> {
  const { user: sessionUser } = await getRequiredSession();
  const memberships = await getDatabase()
    .select({
      userActive: schema.user.active,
      isPlatformAdmin: schema.user.isPlatformAdmin,
      tenantId: schema.tenants.id,
      tenantStatus: schema.tenants.status,
      membershipStatus: schema.tenantMemberships.status,
      role: schema.tenantMemberships.role,
      jobTitle: schema.tenantMemberships.jobTitle,
      customRoleId: schema.tenantMemberships.customRoleId,
      customRoleScope: schema.customRoles.scope,
      branchId: schema.tenantMemberships.branchId,
      branchStatus: schema.branches.status,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .innerJoin(
      schema.tenants,
      eq(schema.tenantMemberships.tenantId, schema.tenants.id),
    )
    .leftJoin(
      schema.branches,
      eq(schema.tenantMemberships.branchId, schema.branches.id),
    )
    .leftJoin(
      schema.customRoles,
      eq(schema.tenantMemberships.customRoleId, schema.customRoles.id),
    )
    .where(eq(schema.tenantMemberships.userId, sessionUser.id));

  if (memberships.length !== 1) {
    throw new AuthorizationError(
      "The authenticated user must have exactly one tenant membership.",
      "INCONSISTENT_MEMBERSHIP",
    );
  }

  const membership = memberships[0];

  if (!membership.userActive) {
    throw new AuthorizationError("The authenticated user is inactive.");
  }

  if (membership.membershipStatus !== "active") {
    throw new AuthorizationError("The tenant membership is inactive.");
  }

  if (membership.tenantStatus !== "active") {
    throw new AuthorizationError("The tenant is not active.");
  }

  // Verificar se há simulação de cargo ativa para o Super-Admin
  let effectiveRole = membership.role;
  let effectiveJobTitle: string = membership.jobTitle || membership.role;

  if (membership.isPlatformAdmin) {
    const override = await getSuperAdminRoleOverride();
    if (override) {
      effectiveRole = override.role;
      effectiveJobTitle = override.jobTitle;
    }
  }

  if (requiresMemberBranch({
    jobTitle: effectiveJobTitle,
    customRoleScope: membership.customRoleScope,
  }) && !membership.branchId) {
    throw new AuthorizationError("O acesso operacional precisa estar vinculado a uma unidade.");
  }

  if (membership.branchId && membership.branchStatus !== "active") {
    throw new AuthorizationError("The associated branch is not active.");
  }

  return {
    userId: sessionUser.id,
    tenantId: membership.tenantId,
    role: effectiveRole,
    jobTitle: effectiveJobTitle,
    customRoleId: membership.customRoleId,
    customRoleScope: membership.customRoleScope,
    branchId: membership.branchId,
  };
}
