import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type DutyRosterSnapshot = Awaited<ReturnType<typeof getDutyRosterSnapshot>>;

export async function getDutyRosterSnapshot(context: TenantContext) {
  const db = getDatabase();
  const branchCondition = context.role === "manager" && context.branchId
    ? and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.id, context.branchId))
    : eq(schema.branches.tenantId, context.tenantId);
  const branches = await db
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(branchCondition)
    .orderBy(asc(schema.branches.name));
  const branchIds = branches.map((branch) => branch.id);
  if (!branchIds.length) return { branches: [], queues: [], credentials: [], schedules: [], brokers: [], assignments: [], history: [] };

  const [queues, credentials, schedules, brokers, assignments] = await Promise.all([
    db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, name: schema.leadQueues.name })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.branchId, branchIds), eq(schema.leadQueues.status, "active")))
      .orderBy(asc(schema.leadQueues.name)),
    db.select({ id: schema.leadWebhookCredentials.id, name: schema.leadWebhookCredentials.name })
      .from(schema.leadWebhookCredentials)
      .where(and(eq(schema.leadWebhookCredentials.tenantId, context.tenantId), eq(schema.leadWebhookCredentials.status, "active")))
      .orderBy(asc(schema.leadWebhookCredentials.name)),
    db.select({
      id: schema.unitDutySchedules.id,
      branchId: schema.unitDutySchedules.branchId,
      branchName: schema.branches.name,
      queueId: schema.unitDutySchedules.queueId,
      queueName: schema.leadQueues.name,
      name: schema.unitDutySchedules.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      status: schema.unitDutySchedules.status,
      timezone: schema.unitDutySchedules.timezone,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
      credentialName: schema.leadWebhookCredentials.name,
    })
      .from(schema.unitDutySchedules)
      .innerJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
      .innerJoin(schema.leadQueues, eq(schema.unitDutySchedules.queueId, schema.leadQueues.id))
      .leftJoin(schema.leadWebhookCredentials, eq(schema.unitDutySchedules.webhookCredentialId, schema.leadWebhookCredentials.id))
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), inArray(schema.unitDutySchedules.branchId, branchIds)))
      .orderBy(asc(schema.unitDutySchedules.dayOfWeek), asc(schema.unitDutySchedules.startsAt)),
    db.select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      branchId: schema.tenantMemberships.branchId,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
    })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        inArray(schema.tenantMemberships.branchId, branchIds),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
      ))
      .orderBy(asc(schema.user.name)),
    db.select({
      id: schema.dutyRosterAssignments.id,
      branchId: schema.dutyRosterAssignments.branchId,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      brokerId: schema.dutyRosterAssignments.brokerId,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      status: schema.dutyRosterAssignments.status,
      brokerName: schema.user.name,
    })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        inArray(schema.dutyRosterAssignments.branchId, branchIds),
        eq(schema.dutyRosterAssignments.status, "active"),
      ))
      .orderBy(asc(schema.dutyRosterAssignments.dayOfWeek), asc(schema.dutyRosterAssignments.startsAt)),
  ]);

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const history = scheduleIds.length
    ? await db.select({
      scheduleId: schema.auditLogs.entidadeId,
      action: schema.auditLogs.acao,
      createdAt: schema.auditLogs.createdAt,
      actorName: schema.user.name,
    })
      .from(schema.auditLogs)
      .innerJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
      .where(and(eq(schema.auditLogs.entidade, "unit_duty_schedule"), inArray(schema.auditLogs.entidadeId, scheduleIds)))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100)
    : [];

  return { branches, queues, credentials, schedules, brokers, assignments, history };
}
