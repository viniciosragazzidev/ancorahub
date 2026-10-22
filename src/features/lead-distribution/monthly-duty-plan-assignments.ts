import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type MonthlyPlanAssignmentEntry = {
  occurrenceId: string;
  brokerId: string;
  rosterAssignmentId?: string;
};

const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

export async function lockMonthlyDutyPlans(tx: Transaction, tenantId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}), hashtext('duty-plan'))`);
}

export function removeMonthlyPlanAssignment<T extends MonthlyPlanAssignmentEntry>(assignments: T[], input: {
  occurrenceId: string;
  brokerId: string;
  rosterAssignmentId?: string;
}) {
  return assignments.filter((item) => !(
    (input.rosterAssignmentId && item.rosterAssignmentId === input.rosterAssignmentId)
    || (item.occurrenceId === input.occurrenceId && item.brokerId === input.brokerId)
  ));
}

export function upsertMonthlyPlanAssignment<T extends MonthlyPlanAssignmentEntry>(assignments: T[], entry: T) {
  return [...assignments.filter((item) => !(item.occurrenceId === entry.occurrenceId && item.brokerId === entry.brokerId)), entry];
}

export async function persistMonthlyPlanAssignmentRemoval(tx: Transaction, input: {
  planId: string;
  planAssignments: MonthlyPlanAssignmentEntry[];
  draft: { id: string; assignments: unknown } | null;
  occurrenceId: string;
  brokerId: string;
  rosterAssignmentId?: string;
  now: Date;
}) {
  const nextPlanAssignments = removeMonthlyPlanAssignment(input.planAssignments, input);
  if (nextPlanAssignments.length !== input.planAssignments.length) {
    await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: nextPlanAssignments, updatedAt: input.now })
      .where(eq(schema.dutyScheduleMonthlyPlans.id, input.planId));
  }
  if (input.draft) {
    const draftAssignments = asArray<MonthlyPlanAssignmentEntry>(input.draft.assignments);
    const nextDraftAssignments = removeMonthlyPlanAssignment(draftAssignments, input);
    if (nextDraftAssignments.length !== draftAssignments.length) {
      await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: nextDraftAssignments, updatedAt: input.now })
        .where(eq(schema.dutyScheduleMonthlyPlans.id, input.draft.id));
    }
  }
}

function previousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

/** Removes the same occurrence reference from the published revision and its newer draft. */
export async function removeDatedRosterAssignmentFromMonthlyPlans(tx: Transaction, input: {
  tenantId: string;
  scheduleId: string;
  brokerId: string;
  dutyDate: string;
  rosterAssignmentId: string;
  now: Date;
}) {
  const occurrenceId = `${input.scheduleId}:${input.dutyDate}`;
  const monthKey = input.dutyDate.slice(0, 7);
  const candidates = await tx.select().from(schema.dutyScheduleMonthlyPlans)
    .where(and(
      eq(schema.dutyScheduleMonthlyPlans.tenantId, input.tenantId),
      eq(schema.dutyScheduleMonthlyPlans.status, "published"),
      inArray(schema.dutyScheduleMonthlyPlans.monthKey, [monthKey, previousMonthKey(monthKey)]),
    ))
    .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision));
  const plan = candidates.find((candidate) => asArray<{ id: string }>(candidate.occurrences).some((occurrence) => occurrence.id === occurrenceId));
  // A dated row without a published plan (e.g. one made outside the monthly escala) has no JSON entry to clean.
  if (!plan) return;

  const [latest] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
    .where(and(
      eq(schema.dutyScheduleMonthlyPlans.tenantId, input.tenantId),
      eq(schema.dutyScheduleMonthlyPlans.monthKey, plan.monthKey),
    ))
    .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision))
    .limit(1);
  const draft = latest?.status === "draft" && latest.revision > plan.revision ? latest : null;
  const assignments = asArray<MonthlyPlanAssignmentEntry>(plan.assignments);
  await persistMonthlyPlanAssignmentRemoval(tx, {
    planId: plan.id,
    planAssignments: assignments,
    draft,
    occurrenceId,
    brokerId: input.brokerId,
    rosterAssignmentId: input.rosterAssignmentId,
    now: input.now,
  });
}
