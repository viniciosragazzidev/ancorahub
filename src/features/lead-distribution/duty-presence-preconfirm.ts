import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";

import { getDatabase, schema, type DatabaseExecutor } from "@/shared/db";
import { getDutyWindowOnDate } from "./duty-presence-domain";
import { claimDutyPresencePreconfirmation } from "./duty-presence-preconfirm-claim";
import { selectContiguousNextPresenceOccurrence } from "./duty-presence-preconfirm-domain";

export type CurrentDutyPresence = {
  assignmentId: string;
  brokerId: string;
  presenceStatus: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type ContiguousDutyTarget = {
  assignmentId: string;
  scheduleId: string;
  scheduleName: string;
  brokerId: string;
  dutyDate: string;
  startsAt: Date;
  endsAt: Date;
  status: string | null;
};

function dateInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function occurrenceKey(assignmentId: string, dutyDate: string, startsAt: Date, endsAt: Date) {
  return `${assignmentId}|${dutyDate}|${startsAt.getTime()}|${endsAt.getTime()}`;
}

export async function listContiguousNextDutyTargets(
  tenantId: string,
  currentEntries: readonly CurrentDutyPresence[],
  now: Date,
  db: DatabaseExecutor = getDatabase(),
  allowConfirmed = false,
) {
  const current = currentEntries.filter((entry): entry is CurrentDutyPresence & { startsAt: Date; endsAt: Date } =>
    entry.presenceStatus === "confirmed"
    && entry.startsAt instanceof Date
    && entry.endsAt instanceof Date
    && entry.startsAt <= now
    && now < entry.endsAt);
  const targets = new Map<string, ContiguousDutyTarget>();
  if (!current.length) return targets;

  const brokerIds = [...new Set(current.map((entry) => entry.brokerId))];
  const candidates = await db.select({
    assignmentId: schema.dutyRosterAssignments.id,
    brokerId: schema.dutyRosterAssignments.brokerId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    assignmentDutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    assignmentValidFrom: schema.dutyRosterAssignments.validFrom,
    assignmentValidUntil: schema.dutyRosterAssignments.validUntil,
    timezone: schema.unitDutySchedules.timezone,
    scheduleName: schema.unitDutySchedules.name,
    scheduleValidFrom: schema.unitDutySchedules.validFrom,
    scheduleValidUntil: schema.unitDutySchedules.validUntil,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      inArray(schema.dutyRosterAssignments.brokerId, brokerIds),
      eq(schema.dutyRosterAssignments.status, "active"),
      eq(schema.unitDutySchedules.status, "active"),
    ));

  const possible: Array<{ sourceId: string; candidate: ContiguousDutyTarget }> = [];
  for (const source of current) {
    const matches: ContiguousDutyTarget[] = [];
    for (const row of candidates) {
      if (row.brokerId !== source.brokerId || row.assignmentId === source.assignmentId) continue;
      const dutyDate = row.assignmentDutyDate ?? dateInTimezone(source.endsAt, row.timezone);
      if (row.assignmentDutyDate && row.assignmentDutyDate !== dateInTimezone(source.endsAt, row.timezone)) continue;
      const window = getDutyWindowOnDate({ dayOfWeek: row.dayOfWeek, startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone }, dutyDate);
      if (!window || window.startsAt.getTime() !== source.endsAt.getTime()) continue;
      if (window.startsAt < row.assignmentValidFrom || (row.assignmentValidUntil && window.startsAt >= row.assignmentValidUntil)) continue;
      if (window.startsAt < row.scheduleValidFrom || (row.scheduleValidUntil && window.startsAt >= row.scheduleValidUntil)) continue;
      matches.push({ assignmentId: row.assignmentId, scheduleId: row.scheduleId, scheduleName: row.scheduleName, brokerId: row.brokerId, dutyDate, startsAt: window.startsAt, endsAt: window.endsAt, status: null });
    }
    if (matches.length !== 1) continue;
    possible.push({ sourceId: source.assignmentId, candidate: matches[0] });
  }
  if (!possible.length) return targets;

  const targetAssignmentIds = [...new Set(possible.map(({ candidate }) => candidate.assignmentId))];
  const targetDates = [...new Set(possible.map(({ candidate }) => candidate.dutyDate))];
  const existingRows = await db.select({
    assignmentId: schema.dutyPresenceConfirmations.assignmentId,
    dutyDate: sql<string>`${schema.dutyPresenceConfirmations.dutyDate}::text`,
    startsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
    endsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
    status: schema.dutyPresenceConfirmations.status,
  }).from(schema.dutyPresenceConfirmations).where(and(
    eq(schema.dutyPresenceConfirmations.tenantId, tenantId),
    inArray(schema.dutyPresenceConfirmations.assignmentId, targetAssignmentIds),
    inArray(schema.dutyPresenceConfirmations.dutyDate, targetDates),
  ));
  const statusByKey = new Map(existingRows.map((row) => [occurrenceKey(row.assignmentId, row.dutyDate, row.startsAt, row.endsAt), row.status]));
  const bySource = new Map<string, ContiguousDutyTarget[]>();
  for (const { sourceId, candidate } of possible) {
    const list = bySource.get(sourceId) ?? [];
    list.push(candidate);
    bySource.set(sourceId, list);
  }
  for (const source of current) {
    const candidatesForSource = bySource.get(source.assignmentId) ?? [];
    const selected = selectContiguousNextPresenceOccurrence({
      currentEndsAt: source.endsAt,
      allowConfirmed,
      candidates: candidatesForSource.map((candidate) => ({
        assignmentId: candidate.assignmentId,
        dutyDate: candidate.dutyDate,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
        status: statusByKey.get(occurrenceKey(candidate.assignmentId, candidate.dutyDate, candidate.startsAt, candidate.endsAt)) ?? null,
      })),
    });
    if (selected) {
      const candidate = candidatesForSource.find((item) => item.assignmentId === selected.assignmentId)!;
      targets.set(source.assignmentId, {
        ...candidate,
        status: statusByKey.get(occurrenceKey(candidate.assignmentId, candidate.dutyDate, candidate.startsAt, candidate.endsAt)) ?? null,
      });
    }
  }
  return targets;
}

export async function preconfirmContiguousDutyTarget(input: {
  tenantId: string;
  scheduleId: string;
  sourceAssignmentId: string;
  expectedTargetAssignmentId: string;
  actorId: string;
  now?: Date;
}): Promise<{ kind: "confirmed" | "already_confirmed" } | { kind: "unavailable" }> {
  const now = input.now ?? new Date();
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const [source] = await tx.select({ id: schema.dutyRosterAssignments.id, brokerId: schema.dutyRosterAssignments.brokerId })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
      .where(and(
        eq(schema.dutyRosterAssignments.id, input.sourceAssignmentId),
        eq(schema.dutyRosterAssignments.scheduleId, input.scheduleId),
        eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.unitDutySchedules.status, "active"),
      )).limit(1).for("update");
    if (!source) return { kind: "unavailable" as const };

    const [currentPresence] = await tx.select({ assignmentId: schema.dutyPresenceConfirmations.assignmentId, brokerId: schema.dutyPresenceConfirmations.brokerId, shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt, shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt })
      .from(schema.dutyPresenceConfirmations)
      .where(and(
        eq(schema.dutyPresenceConfirmations.tenantId, input.tenantId),
        eq(schema.dutyPresenceConfirmations.assignmentId, source.id),
        eq(schema.dutyPresenceConfirmations.status, "confirmed"),
        lte(schema.dutyPresenceConfirmations.shiftStartsAt, now),
        gt(schema.dutyPresenceConfirmations.shiftEndsAt, now),
      )).orderBy(asc(schema.dutyPresenceConfirmations.shiftStartsAt)).limit(1).for("update");
    if (!currentPresence) return { kind: "unavailable" as const };

    const currentEntry: CurrentDutyPresence = {
      assignmentId: source.id,
      brokerId: currentPresence.brokerId,
      presenceStatus: "confirmed",
      startsAt: currentPresence.shiftStartsAt,
      endsAt: currentPresence.shiftEndsAt,
    };
    const targets = await listContiguousNextDutyTargets(input.tenantId, [currentEntry], now, tx, true);
    const target = targets.get(source.id);
    if (!target || target.assignmentId !== input.expectedTargetAssignmentId) return { kind: "unavailable" as const };
    if (target.status === "confirmed") return { kind: "already_confirmed" as const };

    const [lockedTarget] = await tx.select({ id: schema.dutyRosterAssignments.id })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId), eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId)))
      .where(and(
        eq(schema.dutyRosterAssignments.id, target.assignmentId),
        eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
        eq(schema.dutyRosterAssignments.brokerId, target.brokerId),
        eq(schema.dutyRosterAssignments.scheduleId, target.scheduleId),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.unitDutySchedules.status, "active"),
      )).limit(1).for("update");
    if (!lockedTarget) return { kind: "unavailable" as const };

    const revalidatedTargets = await listContiguousNextDutyTargets(input.tenantId, [currentEntry], now, tx, true);
    const revalidated = revalidatedTargets.get(source.id);
    if (!revalidated
      || revalidated.assignmentId !== target.assignmentId
      || revalidated.dutyDate !== target.dutyDate
      || revalidated.startsAt.getTime() !== target.startsAt.getTime()
      || revalidated.endsAt.getTime() !== target.endsAt.getTime()) return { kind: "unavailable" as const };

    const claim = await claimDutyPresencePreconfirmation(tx, {
      tenantId: input.tenantId,
      scheduleId: revalidated.scheduleId,
      assignmentId: revalidated.assignmentId,
      brokerId: revalidated.brokerId,
      dutyDate: revalidated.dutyDate,
      startsAt: revalidated.startsAt,
      endsAt: revalidated.endsAt,
      actorId: input.actorId,
      now,
    });
    if (claim.kind === "already_confirmed") return { kind: "already_confirmed" as const };
    if (claim.kind !== "claimed") return { kind: "unavailable" as const };
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: input.actorId, entidade: "duty_presence_confirmation", entidadeId: claim.confirmationId,
      acao: "duty_presence.preconfirmed_contiguous", createdAt: now,
    });
    return { kind: "confirmed" as const };
  });
}
