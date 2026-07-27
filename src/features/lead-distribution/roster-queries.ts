import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export async function getDutyRosterSnapshot(context: TenantContext) {
  const db = getDatabase();
  const branchCondition = context.role === "manager" && context.branchId
    ? and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.id, context.branchId))
    : eq(schema.branches.tenantId, context.tenantId);
  const branches = await db.select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(branchCondition)
    .orderBy(asc(schema.branches.name));
  const branchIds = branches.map((branch) => branch.id);
  if (!branchIds.length) return { branches: [], schedules: [], brokers: [], assignments: [] };

  const [schedules, brokers, assignments] = await Promise.all([
    db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, queueId: schema.unitDutySchedules.queueId, name: schema.unitDutySchedules.name, dayOfWeek: schema.unitDutySchedules.dayOfWeek, startsAt: schema.unitDutySchedules.startsAt, endsAt: schema.unitDutySchedules.endsAt, priority: schema.unitDutySchedules.priority, status: schema.unitDutySchedules.status })
      .from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), inArray(schema.unitDutySchedules.branchId, branchIds)))
      .orderBy(asc(schema.unitDutySchedules.dayOfWeek), asc(schema.unitDutySchedules.startsAt)),
    db.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, branchId: schema.tenantMemberships.branchId, availabilityStatus: schema.tenantMemberships.availabilityStatus })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.branchId, branchIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active")))
      .orderBy(asc(schema.user.name)),
    db.select({ id: schema.dutyRosterAssignments.id, branchId: schema.dutyRosterAssignments.branchId, scheduleId: schema.dutyRosterAssignments.scheduleId, brokerId: schema.dutyRosterAssignments.brokerId, dayOfWeek: schema.dutyRosterAssignments.dayOfWeek, startsAt: schema.dutyRosterAssignments.startsAt, endsAt: schema.dutyRosterAssignments.endsAt, status: schema.dutyRosterAssignments.status, brokerName: schema.user.name })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
      .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), inArray(schema.dutyRosterAssignments.branchId, branchIds), eq(schema.dutyRosterAssignments.status, "active")))
      .orderBy(asc(schema.dutyRosterAssignments.dayOfWeek), asc(schema.dutyRosterAssignments.startsAt)),
  ]);

  return { branches, schedules, brokers, assignments };
}
