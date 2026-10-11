import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type JourneyManagementScope = {
  tenantId: string;
  userId: string;
  role: "director" | "manager" | "supervisor";
  branchIds: string[];
  supervisorIds: string[];
  brokerIds: string[];
};

/** Resolves all audience IDs on the server. Client selections can only narrow this scope. */
export async function resolveJourneyManagementScope(context: TenantContext): Promise<JourneyManagementScope | null> {
  if (context.role !== "director" && context.role !== "manager" && context.role !== "supervisor") return null;
  const db = getDatabase();
  if (context.role === "director") {
    const [branches, supervisors, brokers] = await Promise.all([
      db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"))).catch(() => []),
      db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => []),
      db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => []),
    ]);
    return { tenantId: context.tenantId, userId: context.userId, role: context.role, branchIds: branches.map((r) => r.id), supervisorIds: supervisors.map((r) => r.id), brokerIds: brokers.map((r) => r.id) };
  }

  if (context.role === "manager") {
    const linked = await db.select({ id: schema.tenantManagerBranches.branchId }).from(schema.tenantManagerBranches)
      .innerJoin(schema.branches, and(eq(schema.branches.id, schema.tenantManagerBranches.branchId), eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
      .where(and(eq(schema.tenantManagerBranches.tenantId, context.tenantId), eq(schema.tenantManagerBranches.userId, context.userId))).catch(() => []);
    const branchIds = linked.length ? linked.map((r) => r.id) : context.branchId ? [context.branchId] : [];
    if (!branchIds.length) return null;
    const [supervisors, brokers] = await Promise.all([
      db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "supervisor"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"), inArray(schema.tenantMemberships.branchId, branchIds))).catch(() => []),
      db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId)).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"), inArray(schema.tenantMemberships.branchId, branchIds))).catch(() => []),
    ]);
    return { tenantId: context.tenantId, userId: context.userId, role: context.role, branchIds, supervisorIds: supervisors.map((r) => r.id), brokerIds: brokers.map((r) => r.id) };
  }

  if (!context.supervisorTeamScope) return null;
  const team = await db.select({ userId: schema.tenantMemberships.userId, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.supervisorId, context.userId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).catch(() => []);
  return { tenantId: context.tenantId, userId: context.userId, role: context.role, branchIds: [...new Set(team.flatMap((r) => r.branchId ? [r.branchId] : []))], supervisorIds: [context.userId], brokerIds: team.map((r) => r.userId) };
}
