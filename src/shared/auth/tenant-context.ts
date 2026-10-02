import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { TenantContext } from "./types";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { getSuperAdminRoleOverride } from "@/features/super-admin/role-impersonation";
import { selectSingleActiveMembership } from "./active-membership";
import {
  markTenantStart,
  markTenantEnd,
  markDbStart,
  markDbEnd,
  withTimeout,
  getRequestTiming,
  withPerfSpan,
} from "@/shared/observability/request-timing";

export type { TenantContext };

const TENANT_QUERY_TIMEOUT_MS = 5_000;

/**
 * The user's memberships (role, unit, status) were re-read on every request.
 * Kept for 20s per user in this process: a role/unit change or a deactivation
 * applies within 20s; membership writers can call invalidateTenantContextCache.
 */
const MEMBERSHIP_CACHE_TTL_MS = 20_000;

function loadMemberships(userId: string) {
  return getDatabase()
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
    .innerJoin(schema.tenants, eq(schema.tenantMemberships.tenantId, schema.tenants.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, userId));
}

const membershipCache = new TtlCache<Awaited<ReturnType<typeof loadMemberships>>>(MEMBERSHIP_CACHE_TTL_MS, 2000);

export function invalidateTenantContextCache(userId?: string) {
  if (userId) membershipCache.delete(userId);
  else membershipCache.clear();
}

async function resolveRequiredTenantContext(): Promise<TenantContext> {
  // Session phase is already timed by getRequiredSession()
  const { user: sessionUser } = await getRequiredSession();

  markTenantStart();
  markDbStart();

  try {
    const memberships = await membershipCache.getOrLoad(sessionUser.id, () => withPerfSpan("tenant.resolve", () => withTimeout(
      loadMemberships(sessionUser.id),
      TENANT_QUERY_TIMEOUT_MS,
      "getRequiredTenantContext",
    )));

    markDbEnd();
    markTenantEnd();

    const membership = selectSingleActiveMembership(memberships);

    if (!membership.userActive) {
      throw new AuthorizationError("The authenticated user is inactive.");
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

/**
 * Request-scoped only: a layout and its page share one authoritative tenant
 * lookup, while every new request still rechecks membership and permissions.
 */
export const getRequiredTenantContext = cache(resolveRequiredTenantContext);
