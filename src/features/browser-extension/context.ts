import "server-only";
import { eq, and } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

export async function getExtensionTenantContext(userId: string, tenantId: string): Promise<TenantContext | null> {
  const [membership] = await getDatabase().select({
    role: schema.tenantMemberships.role,
    jobTitle: schema.tenantMemberships.jobTitle,
    branchId: schema.tenantMemberships.branchId,
  }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .innerJoin(schema.branches, and(
      eq(schema.branches.id, schema.tenantMemberships.branchId),
      eq(schema.branches.tenantId, schema.tenantMemberships.tenantId),
    )).where(and(
      eq(schema.user.active, true), eq(schema.user.status, "active"),
      eq(schema.branches.status, "active"),
      eq(schema.tenantMemberships.userId, userId), eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.status, "active"),
    )).limit(1);
  return membership ? { userId, tenantId, role: membership.role, jobTitle: membership.jobTitle, branchId: membership.branchId } : null;
}
