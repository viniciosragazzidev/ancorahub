import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { TenantContext } from "./types";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { getSuperAdminRoleOverride } from "@/features/super-admin/role-impersonation";
import {
  markTenantStart,
  markTenantEnd,
  markDbStart,
  markDbEnd,
  withTimeout,
  getRequestTiming,
} from "@/shared/observability/request-timing";

export type { TenantContext };

const TENANT_QUERY_TIMEOUT_MS = 5_000;

export async function getRequiredTenantContext(): Promise<TenantContext> {
  // Session phase is already timed by getRequiredSession()
  const { user: sessionUser } = await getRequiredSession();

  markTenantStart();
  markDbStart();

  try {
    const memberships = await withTimeout(
      getDatabase()
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
        .where(eq(schema.tenantMemberships.userId, sessionUser.id)),
      TENANT_QUERY_TIMEOUT_MS,
      "getRequiredTenantContext",
    );

    markDbEnd();
    markTenantEnd();

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

    if (
      requiresMemberBranch({
        jobTitle: membership.jobTitle,
        customRoleScope: membership.customRoleScope,
      }) &&
      !membership.branchId
    ) {
      throw new AuthorizationError(
        "O acesso operacional precisa estar vinculado a uma unidade.",
      );
    }

    if (membership.branchId && membership.branchStatus !== "active") {
      throw new AuthorizationError("The associated branch is not active.");
    }

    return {
      userId: sessionUser.id,
      tenantId: membership.tenantId,
      role: membership.role,
      jobTitle: membership.jobTitle,
      customRoleId: membership.customRoleId,
      customRoleScope: membership.customRoleScope,
      branchId: membership.branchId,
    };
  } catch (error) {
    markDbEnd();
    markTenantEnd();

    const timing = getRequestTiming();
    const requestId = timing?.requestId ?? "unknown";
    const isTimeout =
      error instanceof Error && error.message.startsWith("TIMEOUT:");

    if (isTimeout) {
      console.error(
        JSON.stringify({
          type: "tenant_timeout",
          requestId,
          timeoutMs: TENANT_QUERY_TIMEOUT_MS,
        }),
      );
      throw new AuthorizationError(
        "A resolução de contexto está demorando mais que o esperado. Tente novamente.",
        "TENANT_TIMEOUT",
      );
    }

    // Re-throw AuthorizationError as-is
    if (error instanceof AuthorizationError) {
      throw error;
    }

    // Unexpected error
    console.error(
      JSON.stringify({
        type: "tenant_error",
        requestId,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    throw error;
  }
}
