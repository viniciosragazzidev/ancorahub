import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** Invited brokers (registered, no account yet) put on this plantão: shown as "Convite pendente". */
export async function listPendingRosterEntries(tenantId: string, scheduleId: string) {
  return getDatabase()
    .select({
      id: schema.dutyRosterPending.id,
      brokerProfileId: schema.dutyRosterPending.brokerProfileId,
      name: schema.brokerProfiles.professionalName,
      internalCode: schema.brokerProfiles.internalCode,
      branchName: schema.branches.name,
    })
    .from(schema.dutyRosterPending)
    .innerJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.id, schema.dutyRosterPending.brokerProfileId), eq(schema.brokerProfiles.tenantId, tenantId)))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.brokerProfiles.branchId))
    .where(and(eq(schema.dutyRosterPending.tenantId, tenantId), eq(schema.dutyRosterPending.scheduleId, scheduleId)))
    .orderBy(asc(schema.brokerProfiles.professionalName));
}

/**
 * Brokers registered by invite who have not created their account yet, that
 * the viewer may put on a plantão (a manager: only of their unit).
 */
export async function listInvitedBrokers(tenantId: string, branchId: string | null) {
  return getDatabase()
    .select({ id: schema.brokerProfiles.id, name: schema.brokerProfiles.professionalName, internalCode: schema.brokerProfiles.internalCode, branchName: schema.branches.name })
    .from(schema.brokerProfiles)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.brokerProfiles.branchId))
    .where(and(
      eq(schema.brokerProfiles.tenantId, tenantId),
      isNull(schema.brokerProfiles.userId),
      inArray(schema.brokerProfiles.lifecycleStatus, ["INVITED", "ONBOARDING"]),
      branchId ? eq(schema.brokerProfiles.branchId, branchId) : undefined,
    ))
    .orderBy(asc(schema.brokerProfiles.professionalName));
}

/**
 * The invite was accepted: each plantão the broker was put on becomes a normal
 * roster row (every occurrence of the plantão, like a weekly row) and leaves
 * the pending list. Runs inside the onboarding transaction.
 */
export async function promotePendingRosterEntries(tx: Tx, input: { tenantId: string; brokerProfileId: string; userId: string; branchId: string }) {
  const pending = await tx
    .select({
      id: schema.dutyRosterPending.id,
      createdBy: schema.dutyRosterPending.createdBy,
      scheduleId: schema.unitDutySchedules.id,
      scheduleBranchId: schema.unitDutySchedules.branchId,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      status: schema.unitDutySchedules.status,
    })
    .from(schema.dutyRosterPending)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterPending.scheduleId), eq(schema.unitDutySchedules.tenantId, input.tenantId)))
    .where(and(eq(schema.dutyRosterPending.tenantId, input.tenantId), eq(schema.dutyRosterPending.brokerProfileId, input.brokerProfileId)));
  if (!pending.length) return 0;

  const now = new Date();
  let promoted = 0;
  for (const entry of pending) {
    const stillRunning = entry.status === "active" && (!entry.validUntil || entry.validUntil > now);
    // The broker's unit must be the plantão's, or they would receive another unit's leads.
    if (entry.scheduleBranchId && entry.scheduleBranchId !== input.branchId) {
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.userId, entidade: "duty_roster_pending", entidadeId: entry.id, acao: "duty_roster_pending.skipped_other_unit" });
      continue;
    }
    const [existing] = await tx.select({ id: schema.dutyRosterAssignments.id }).from(schema.dutyRosterAssignments)
      .where(and(eq(schema.dutyRosterAssignments.scheduleId, entry.scheduleId), eq(schema.dutyRosterAssignments.brokerId, input.userId), isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.status, "active")))
      .limit(1);
    if (stillRunning && !existing) {
      const author = entry.createdBy ?? input.userId;
      await tx.insert(schema.dutyRosterAssignments).values({
        id: randomUUID(), tenantId: input.tenantId, branchId: input.branchId, scheduleId: entry.scheduleId, brokerId: input.userId,
        dayOfWeek: entry.dayOfWeek, startsAt: entry.startsAt, endsAt: entry.endsAt, validFrom: entry.validFrom, validUntil: entry.validUntil,
        status: "active", createdBy: author, updatedBy: author, createdAt: now, updatedAt: now,
      });
      promoted += 1;
    }
  }
  await tx.delete(schema.dutyRosterPending).where(and(eq(schema.dutyRosterPending.tenantId, input.tenantId), eq(schema.dutyRosterPending.brokerProfileId, input.brokerProfileId)));
  await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.userId, entidade: "duty_roster_pending", entidadeId: input.brokerProfileId, acao: "duty_roster_pending.promoted" });
  return promoted;
}
