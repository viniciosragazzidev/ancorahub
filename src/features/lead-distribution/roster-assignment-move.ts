import { and, eq, isNull } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

export type WeeklyRosterAssignmentSnapshot = {
  id: string;
  tenantId: string;
  brokerId: string;
  scheduleId: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};

/** Locks and rechecks the source row, then moves it only if that exact source state still matches. */
export async function moveWeeklyRosterAssignment<T>(
  tx: DatabaseExecutor,
  input: {
    expected: WeeklyRosterAssignmentSnapshot;
    target: { scheduleId: string; dayOfWeek: number; startsAt: string; endsAt: string; actorId: string; now: Date };
    prepare: (assignment: WeeklyRosterAssignmentSnapshot) => Promise<T>;
  },
): Promise<{ assignment: WeeklyRosterAssignmentSnapshot; prepared: T } | null> {
  const { expected, target } = input;
  const [assignment] = await tx.select({
    id: schema.dutyRosterAssignments.id,
    tenantId: schema.dutyRosterAssignments.tenantId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
  }).from(schema.dutyRosterAssignments).where(and(
    eq(schema.dutyRosterAssignments.id, expected.id),
    eq(schema.dutyRosterAssignments.tenantId, expected.tenantId),
    eq(schema.dutyRosterAssignments.brokerId, expected.brokerId),
    eq(schema.dutyRosterAssignments.scheduleId, expected.scheduleId),
    eq(schema.dutyRosterAssignments.dayOfWeek, expected.dayOfWeek),
    eq(schema.dutyRosterAssignments.startsAt, expected.startsAt),
    eq(schema.dutyRosterAssignments.endsAt, expected.endsAt),
    eq(schema.dutyRosterAssignments.status, "active"),
    isNull(schema.dutyRosterAssignments.dutyDate),
  )).limit(1).for("update");
  if (!assignment) return null;

  const prepared = await input.prepare(assignment);
  const [moved] = await tx.update(schema.dutyRosterAssignments).set({
    scheduleId: target.scheduleId,
    dayOfWeek: target.dayOfWeek,
    startsAt: target.startsAt,
    endsAt: target.endsAt,
    updatedBy: target.actorId,
    updatedAt: target.now,
  }).where(and(
    eq(schema.dutyRosterAssignments.id, expected.id),
    eq(schema.dutyRosterAssignments.tenantId, expected.tenantId),
    eq(schema.dutyRosterAssignments.brokerId, expected.brokerId),
    eq(schema.dutyRosterAssignments.scheduleId, expected.scheduleId),
    eq(schema.dutyRosterAssignments.dayOfWeek, expected.dayOfWeek),
    eq(schema.dutyRosterAssignments.startsAt, expected.startsAt),
    eq(schema.dutyRosterAssignments.endsAt, expected.endsAt),
    eq(schema.dutyRosterAssignments.status, "active"),
    isNull(schema.dutyRosterAssignments.dutyDate),
  )).returning({ id: schema.dutyRosterAssignments.id });

  return moved ? { assignment, prepared } : null;
}
