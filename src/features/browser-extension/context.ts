import "server-only";
import { eq, and } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";

export async function getExtensionTenantContext(userId: string, tenantId: string): Promise<TenantContext | null> {
  const [membership] = await getDatabase().select({ role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.userId, userId), eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.status, "active"))).limit(1);
  return membership ? { userId, tenantId, role: membership.role, jobTitle: membership.jobTitle, branchId: membership.branchId } : null;
}
