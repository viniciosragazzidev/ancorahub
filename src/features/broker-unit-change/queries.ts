import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { selectAssignmentsToRelease } from "./roster-release";

export type OwnUnitChangeOptions = {
  current: { id: string; name: string } | null;
  /** Other active units of the same company, by name. */
  options: { id: string; name: string }[];
  /** Open plantão slots in the current unit the broker would leave. */
  openDutySlots: number;
};

export async function getOwnUnitChangeOptions(context: { tenantId: string; userId: string; branchId: string | null }, now = new Date()): Promise<OwnUnitChangeOptions> {
  const db = getDatabase();
  const [branches, slots] = await Promise.all([
    db.select({ id: schema.branches.id, name: schema.branches.name, status: schema.branches.status })
      .from(schema.branches)
      .where(eq(schema.branches.tenantId, context.tenantId))
      .orderBy(asc(schema.branches.name)),
    context.branchId
      ? db.select({
        id: schema.dutyRosterAssignments.id,
        dutyDate: schema.dutyRosterAssignments.dutyDate,
        startsAt: schema.dutyRosterAssignments.startsAt,
        endsAt: schema.dutyRosterAssignments.endsAt,
        timezone: schema.unitDutySchedules.timezone,
      })
        .from(schema.dutyRosterAssignments)
        .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.brokerId, context.userId),
          eq(schema.dutyRosterAssignments.status, "active"),
          eq(schema.unitDutySchedules.branchId, context.branchId),
        ))
      : Promise.resolve([]),
  ]);
  const current = branches.find((branch) => branch.id === context.branchId);
  return {
    current: current ? { id: current.id, name: current.name } : null,
    options: branches.filter((branch) => branch.status === "active" && branch.id !== context.branchId).map(({ id, name }) => ({ id, name })),
    openDutySlots: selectAssignmentsToRelease(slots, now).length,
  };
}
