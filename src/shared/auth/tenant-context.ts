import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { TenantContext } from "./types";
export type { TenantContext };

export async function getRequiredTenantContext(): Promise<TenantContext> {
  const { user: sessionUser } = await getRequiredSession();
  const memberships = await getDatabase()
    .select({
      userActive: schema.user.active,
      tenantId: schema.tenants.id,
      tenantStatus: schema.tenants.status,
      membershipStatus: schema.tenantMemberships.status,
      role: schema.tenantMemberships.role,
      jobTitle: schema.tenantMemberships.jobTitle,
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

  const isCentralMarketing = membership.jobTitle === "marketing" && !membership.branchId;
  if ((membership.role === "manager" || membership.role === "broker") && !membership.branchId && !isCentralMarketing) {
    throw new AuthorizationError("O acesso operacional precisa estar vinculado a uma unidade.");
  }

  if (membership.branchId && membership.branchStatus !== "active") {
    throw new AuthorizationError("The associated branch is not active.");
  }

  return {
    userId: sessionUser.id,
    tenantId: membership.tenantId,
    role: membership.role,
    jobTitle: membership.jobTitle,
    branchId: membership.branchId,
  };
}
