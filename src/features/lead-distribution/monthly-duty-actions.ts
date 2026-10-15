"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getRequiredTenantContext, type TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { applyForcedBrokers, generateTypedAssignments } from "./duty-plan-generation";
import { getRosterBrokerAccountFilter } from "./roster-broker-account-filter";
import { decideLeftoverRows } from "./monthly-duty-preservation";
import { publishedAddProblem, publishedRemoveProblem } from "./monthly-duty-published-edit";
import {
  buildRangeOccurrences,
  DATE_KEY_PATTERN,
  dayOfWeekOf,
  daysBetween,
  describeDraftProblem,
  findDraftOverlaps,
  findDraftProblems,
  MAX_PLAN_RANGE_DAYS,
  MONTH_KEY_PATTERN,
  NO_TYPE_KEY,
  occurrenceId as occurrenceIdOf,
  occurrenceValidity,
  parsePlanSettings,
  shiftEnd,
  summarizeDraft,
  typeKeyOf,
  zonedMidnight,
  type MonthlyPlanAssignment,
  type MonthlyPlanOccurrence,
  type PlanBrokerSetting,
  type PlanSettings,
} from "./monthly-duty-plan";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const monthSchema = z.string().regex(MONTH_KEY_PATTERN);
const dateSchema = z.string().regex(DATE_KEY_PATTERN);
const typeKeySchema = z.union([z.literal(NO_TYPE_KEY), z.string().uuid()]);
const brokerSettingSchema = z.object({
  brokerId: z.string().min(1),
  modality: z.enum(["any", "online", "presencial"]).default("any"),
  seats: z.record(typeKeySchema, z.coerce.number().int().min(0).max(62)).default({}),
  forcedTypeKeys: z.array(typeKeySchema).max(50).default([]),
});
const generateSchema = z.object({
  monthKey: monthSchema,
  rangeFrom: dateSchema,
  rangeUntil: dateSchema,
  typeKeys: z.array(typeKeySchema).min(1, "Escolha ao menos um tipo de plantão.").max(50),
  brokers: z.array(brokerSettingSchema).max(500),
});
const editSchema = z.object({
  planId: z.string().uuid(),
  occurrenceId: z.string().min(1).max(120),
  brokerId: z.string().min(1),
  operation: z.enum(["add", "remove"]),
  /** Add a broker whose unit is outside the plantão's type (the Diretor confirmed). */
  force: z.boolean().optional(),
});

type StoredQuota = { brokerId: string; quota: number };
type StoredAssignment = MonthlyPlanAssignment & { rosterAssignmentId?: string };

const PLANTAO_PATH = "/leads/distribuicao";

async function readScope() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Diretores e Gestores podem ver a escala mensal.");
  if (context.role === "manager" && !context.branchId) throw new Error("A unidade do Gestor não está definida.");
  return context;
}

/** Plantões are global (DEC-110): only the Director plans, edits and publishes the escala. */
async function writeScope() {
  const context = await readScope();
  if (context.role !== "director") throw new Error("Apenas o Diretor pode montar e publicar a escala mensal.");
  if ((await getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING)) !== "true") throw new Error("A escala mensal está desativada pelo Super-admin.");
  return context;
}

/**
 * Serialises every escala write of a tenant (generate, edit, publish). One
 * lock per tenant, not per month: an escala may run into the next month.
 */
async function lockPlans(tx: Transaction, tenantId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}), hashtext('duty-plan'))`);
}

async function loadPlanningBrokers(db: Executor, tenantId: string) {
  const rows = await db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .innerJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, schema.tenantMemberships.tenantId)))
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.jobTitle, "broker"),
      await getRosterBrokerAccountFilter(),
      eq(schema.branches.status, "active"),
    ));
  return rows.filter((row): row is typeof row & { branchId: string } => Boolean(row.branchId));
}

async function loadActiveSchedules(db: Executor, tenantId: string) {
  const rows = await db.select({
    id: schema.unitDutySchedules.id,
    name: schema.unitDutySchedules.name,
    branchId: schema.unitDutySchedules.branchId,
    dayOfWeek: schema.unitDutySchedules.dayOfWeek,
    startsAt: schema.unitDutySchedules.startsAt,
    endsAt: schema.unitDutySchedules.endsAt,
    minimumBrokers: schema.unitDutySchedules.minimumBrokers,
    maximumBrokers: schema.unitDutySchedules.maximumBrokers,
    timezone: schema.unitDutySchedules.timezone,
    validFrom: schema.unitDutySchedules.validFrom,
    validUntil: schema.unitDutySchedules.validUntil,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    typeId: schema.unitDutySchedules.typeId,
    typeBranchIds: schema.dutyScheduleTypes.branchIds,
  }).from(schema.unitDutySchedules)
    .leftJoin(schema.dutyScheduleTypes, and(eq(schema.dutyScheduleTypes.id, schema.unitDutySchedules.typeId), eq(schema.dutyScheduleTypes.tenantId, schema.unitDutySchedules.tenantId)))
    .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), eq(schema.unitDutySchedules.status, "active")));
  return rows.map((row) => ({ ...row, typeBranchIds: Array.isArray(row.typeBranchIds) ? row.typeBranchIds : [] }));
}

async function loadLatestPlan(db: Executor, tenantId: string, monthKey: string) {
  const [plan] = await db.select().from(schema.dutyScheduleMonthlyPlans)
    .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey)))
    .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision))
    .limit(1);
  return plan ?? null;
}

const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

/** A shift that already started (running or over): its brokers are never re-drawn. */
function occurrenceStarted(occurrence: Pick<MonthlyPlanOccurrence, "dutyDate" | "startsAt">, now: Date) {
  const [hours, minutes] = occurrence.startsAt.split(":").map(Number);
  return zonedMidnight(occurrence.dutyDate, "America/Sao_Paulo").getTime() + (hours * 60 + minutes) * 60_000 <= now.getTime();
}

/** Stored occurrences carry no time zone; plantões run on São Paulo time. */
function occurrenceEnded(occurrence: Pick<MonthlyPlanOccurrence, "dutyDate" | "startsAt" | "endsAt">, now: Date) {
  return shiftEnd({ ...occurrence, timezone: "America/Sao_Paulo" }, occurrence.dutyDate).getTime() <= now.getTime();
}

async function audit(db: Executor, userId: string, planId: string, acao: string) {
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "duty_schedule_monthly_plan", entidadeId: planId, acao });
}

function monthEnd(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Period of a plan: its settings, or (escalas before DEC-138) its occurrences / the month. */
function planRange(plan: { monthKey: string; settings: unknown }, occurrences: readonly MonthlyPlanOccurrence[]) {
  const settings = parsePlanSettings(plan.settings);
  if (settings) return { rangeFrom: settings.rangeFrom, rangeUntil: settings.rangeUntil };
  const dates = occurrences.map((occurrence) => occurrence.dutyDate).sort();
  return { rangeFrom: dates[0] ?? `${plan.monthKey}-01`, rangeUntil: dates.at(-1) ?? monthEnd(plan.monthKey) };
}

/** View model of a month's escala for the planner; Managers only see their unit's brokers. */
async function buildPlanView(db: Executor, context: TenantContext, monthKey: string) {
  const plan = await loadLatestPlan(db, context.tenantId, monthKey);
  if (!plan) return null;
  const occurrences = asArray<MonthlyPlanOccurrence>(plan.occurrences);
  const allAssignments = asArray<StoredAssignment>(plan.assignments);
  const quotas = asArray<StoredQuota>(plan.quotas);
  const settings = parsePlanSettings(plan.settings);
  const brokerIds = [...new Set([...allAssignments.map((item) => item.brokerId), ...quotas.map((item) => item.brokerId), ...(settings?.brokers.map((item) => item.brokerId) ?? [])])];
  const people = brokerIds.length
    ? await db.select({
      id: schema.user.id,
      name: schema.user.name,
      branchId: schema.tenantMemberships.branchId,
      branchName: schema.branches.name,
      code: schema.brokerProfiles.internalCode,
    })
      .from(schema.user)
      .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
      .leftJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, context.tenantId)))
      .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
      .where(inArray(schema.user.id, brokerIds))
    : [];
  const person = new Map(people.map((row) => [row.id, row]));
  const visible = (brokerId: string) => context.role !== "manager" || person.get(brokerId)?.branchId === context.branchId;
  const assignments = allAssignments.filter((item) => visible(item.brokerId));
  const visibleQuotas = quotas.filter((item) => visible(item.brokerId));
  const summary = summarizeDraft(occurrences, allAssignments, new Map(visibleQuotas.map((item) => [item.brokerId, item.quota])));
  const problems = plan.status === "draft" ? findDraftProblems(occurrences, allAssignments) : [];
  // DEC-132: simultaneous occurrences are allowed; they surface as a warning.
  const warnings = plan.status === "draft" ? findDraftOverlaps(occurrences, allAssignments) : [];
  // Plantões of the draft that no longer exist on their date: publishing leaves them out.
  const staleLabels: string[] = [];
  if (plan.status === "draft") {
    const now = new Date();
    const active = new Map((await loadActiveSchedules(db, context.tenantId)).map((schedule) => [schedule.id, schedule]));
    for (const occurrence of occurrences) {
      if (occurrenceEnded(occurrence, now)) continue;
      const schedule = active.get(occurrence.scheduleId);
      if (!schedule || !buildRangeOccurrences(occurrence.dutyDate, occurrence.dutyDate, [schedule], []).length) {
        staleLabels.push(`${occurrence.scheduleName} ${occurrence.dutyDate.slice(8, 10)}/${occurrence.dutyDate.slice(5, 7)}`);
      }
    }
  }
  const now = new Date();
  const [publishedBefore] = plan.status === "draft"
    ? await db.select({ id: schema.dutyScheduleMonthlyPlans.id, occurrences: schema.dutyScheduleMonthlyPlans.occurrences, assignments: schema.dutyScheduleMonthlyPlans.assignments }).from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey), eq(schema.dutyScheduleMonthlyPlans.status, "published")))
      .limit(1)
    : [];
  const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
  // Seats given per broker per type, to show "2 de 3" next to each seat.
  const assignedByBrokerType = new Map<string, number>();
  for (const item of allAssignments) {
    const key = `${item.brokerId}|${typeKeyOf(occurrenceById.get(item.occurrenceId)?.typeId)}`;
    assignedByBrokerType.set(key, (assignedByBrokerType.get(key) ?? 0) + 1);
  }
  const brokerView = (brokerId: string) => {
    const row = person.get(brokerId);
    return { id: brokerId, name: row?.name ?? "Corretor", code: row?.code ?? null, branchId: row?.branchId ?? null, branchName: row?.branchName ?? null };
  };
  return {
    id: plan.id,
    monthKey: plan.monthKey,
    revision: plan.revision,
    status: plan.status as "draft" | "published",
    publishedAt: plan.publishedAt?.toISOString() ?? null,
    ...planRange(plan, occurrences),
    /** Null on escalas generated before plantão types. */
    settings: settings ? { ...settings, brokers: settings.brokers.filter((item) => visible(item.brokerId)) } : null,
    quotas: visibleQuotas.map((item) => ({ ...item, assigned: summary.assignedByBroker.get(item.brokerId) ?? 0 })),
    brokerSeats: Object.fromEntries([...assignedByBrokerType].filter(([key]) => visible(key.split("|")[0]))),
    brokers: brokerIds.filter(visible).map(brokerView),
    occurrences: occurrences.map((occurrence) => ({
      ...occurrence,
      brokers: assignments.filter((item) => item.occurrenceId === occurrence.id).map((item) => ({
        ...brokerView(item.brokerId),
        forced: Boolean(occurrence.forcedBrokerIds?.includes(item.brokerId)),
        /** Already on the roster before this generation (kept), or new now. */
        origin: (item.origin ?? (plan.status === "draft" ? "generated" : "existing")) as "existing" | "weekly" | "generated" | "manual",
      })),
      assignedCount: summary.assignedByOccurrence.get(occurrence.id) ?? 0,
      /** Shift already over: read-only in a draft and never published. */
      ended: occurrenceEnded(occurrence, now),
      /** Running now: its brokers are not removed. */
      started: occurrenceStarted(occurrence, now),
    })),
    totalAssigned: allAssignments.length,
    belowMinimum: summary.belowMinimum,
    missingQuota: summary.missingQuota,
    problems: [...new Set(problems.map(describeDraftProblem))],
    warnings: [
      ...new Set(warnings.map(describeDraftProblem)),
      ...(staleLabels.length ? [`${staleLabels.length === 1 ? "Este plantão não existe mais" : "Estes plantões não existem mais"} (removido, inativo ou com outra data) e ${staleLabels.length === 1 ? "será ignorado" : "serão ignorados"} ao publicar: ${staleLabels.join(", ")}.`] : []),
    ],
    canEdit: context.role === "director",
    /** Publishing this draft replaces a published escala on the dates that have not ended. */
    replacesPublished: Boolean(publishedBefore),
    /** Occurrences of this draft that the published revision already staffed: live, not pending. */
    publishedOccurrenceIds: publishedBefore ? liveOccurrenceIds(publishedBefore, occurrences) : [],
  };
}

/** Ids of the draft's occurrences that the published revision already staffed. */
function liveOccurrenceIds(
  published: { occurrences: unknown; assignments: unknown },
  occurrences: readonly MonthlyPlanOccurrence[],
): string[] {
  const assignments = asArray<StoredAssignment>(published.assignments);
  const live = new Set(asArray<MonthlyPlanOccurrence>(published.occurrences)
    .filter((item) => assignments.some((assignment) => assignment.occurrenceId === item.id))
    .map((item) => item.id));
  return occurrences.filter((item) => live.has(item.id)).map((item) => item.id);
}

export type MonthlyDutyPlanView = NonNullable<Awaited<ReturnType<typeof buildPlanView>>>;

export async function getMonthlyDutyPlanAction(monthKeyInput: string): Promise<MonthlyDutyPlanView | null> {
  const context = await readScope();
  return buildPlanView(getDatabase(), context, monthSchema.parse(monthKeyInput));
}

/**
 * The new settings on top of the previous revision's: the types chosen now
 * take their brokers and seats from this input; every other type keeps what
 * the previous revision had (an escala of PME does not undo the Premium one).
 */
function mergeSettings(previous: PlanSettings | null, input: Omit<PlanSettings, "brokers"> & { brokers: PlanBrokerSetting[] }): PlanSettings {
  const chosen = new Set(input.typeKeys);
  const byBroker = new Map<string, PlanBrokerSetting>();
  for (const broker of previous?.brokers ?? []) {
    const seats = Object.fromEntries(Object.entries(broker.seats).filter(([key]) => !chosen.has(key)));
    if (Object.keys(seats).length) byBroker.set(broker.brokerId, { ...broker, seats, forcedTypeKeys: broker.forcedTypeKeys.filter((key) => !chosen.has(key)) });
  }
  for (const broker of input.brokers) {
    const seats = Object.fromEntries(Object.entries(broker.seats).filter(([key, value]) => chosen.has(key) && value > 0));
    const kept = byBroker.get(broker.brokerId);
    byBroker.set(broker.brokerId, {
      brokerId: broker.brokerId,
      modality: broker.modality,
      seats: { ...(kept?.seats ?? {}), ...seats },
      forcedTypeKeys: [...new Set([...(kept?.forcedTypeKeys ?? []), ...broker.forcedTypeKeys.filter((key) => chosen.has(key))])],
    });
  }
  return {
    rangeFrom: previous && previous.rangeFrom < input.rangeFrom ? previous.rangeFrom : input.rangeFrom,
    rangeUntil: previous && previous.rangeUntil > input.rangeUntil ? previous.rangeUntil : input.rangeUntil,
    typeKeys: [...new Set([...(previous?.typeKeys ?? []), ...input.typeKeys])],
    generatedTypeKeys: [...input.typeKeys],
    brokers: [...byBroker.values()].filter((broker) => Object.keys(broker.seats).length > 0),
  };
}

/**
 * Generates a new draft revision for the chosen plantão types over a period
 * that starts in `monthKey` and may run into the next month. Assignments of
 * the previous revision outside this choice (other types or dates) are kept.
 */
export async function generateMonthlyDutyPlanAction(rawInput: unknown): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const input = generateSchema.parse(rawInput);
  const { monthKey, rangeFrom, rangeUntil } = input;
  if (rangeFrom.slice(0, 7) !== monthKey) throw new Error("O período da escala precisa começar dentro do mês escolhido.");
  if (rangeUntil < rangeFrom) throw new Error("O fim do período não pode ser antes do início.");
  if (daysBetween(rangeFrom, rangeUntil) > MAX_PLAN_RANGE_DAYS) throw new Error(`O período da escala pode ter no máximo ${MAX_PLAN_RANGE_DAYS} dias.`);
  if (new Set(input.brokers.map((item) => item.brokerId)).size !== input.brokers.length) throw new Error("Um corretor aparece duas vezes na escala. Recarregue a página.");
  const chosenKeys = new Set(input.typeKeys);
  const db = getDatabase();

  const planId = await db.transaction(async (tx) => {
    await lockPlans(tx, context.tenantId);
    const latest = await loadLatestPlan(tx, context.tenantId, monthKey);

    const [brokers, schedules, windows] = await Promise.all([
      loadPlanningBrokers(tx, context.tenantId),
      loadActiveSchedules(tx, context.tenantId),
      tx.select({ brokerId: schema.brokerAvailabilityWindows.brokerId, dayOfWeek: schema.brokerAvailabilityWindows.dayOfWeek, startsAt: schema.brokerAvailabilityWindows.startsAt, endsAt: schema.brokerAvailabilityWindows.endsAt })
        .from(schema.brokerAvailabilityWindows)
        .where(eq(schema.brokerAvailabilityWindows.tenantId, context.tenantId)),
    ]);
    const brokerIds = new Set(brokers.map((broker) => broker.id));
    if (input.brokers.some((item) => !brokerIds.has(item.brokerId))) {
      throw new Error("A escala contém corretor fora da corretora ou da política de inclusão na escala. Recarregue a página.");
    }
    const settingsInput = {
      rangeFrom,
      rangeUntil,
      typeKeys: [...chosenKeys],
      brokers: input.brokers.map((broker) => ({ ...broker, seats: Object.fromEntries(Object.entries(broker.seats).filter(([key, value]) => chosenKeys.has(key) && value > 0)) })),
    };
    const now = new Date();
    // Only shifts that have not ended yet: a past plantão is never staffed.
    const chosenSchedules = schedules.filter((schedule) => chosenKeys.has(typeKeyOf(schedule.typeId)));
    const fresh = applyForcedBrokers(buildRangeOccurrences(rangeFrom, rangeUntil, chosenSchedules, brokers, { from: now }), settingsInput);
    if (!fresh.length) throw new Error("Nenhum plantão desses tipos ainda vai acontecer no período escolhido.");

    // What the previous revision had outside this choice stays as it was.
    // Escalas before plantão types stored no type: take it from the plantão.
    const typeBySchedule = new Map(schedules.map((schedule) => [schedule.id, schedule.typeId]));
    const previousOccurrences = (latest ? asArray<MonthlyPlanOccurrence>(latest.occurrences) : [])
      .map((occurrence) => (occurrence.typeId === undefined ? { ...occurrence, typeId: typeBySchedule.get(occurrence.scheduleId) ?? null } : occurrence));
    const previousAssignments = latest ? asArray<StoredAssignment>(latest.assignments) : [];
    // A plantão already running keeps its brokers as they are: re-drawing it
    // would take someone off the roster in the middle of the shift.
    const previousIds = new Set(previousOccurrences.map((occurrence) => occurrence.id));
    const running = new Set(fresh.filter((occurrence) => previousIds.has(occurrence.id) && occurrenceStarted(occurrence, now)).map((occurrence) => occurrence.id));
    const toDraw = fresh.filter((occurrence) => !running.has(occurrence.id));
    const freshIds = new Set(toDraw.map((occurrence) => occurrence.id));
    const regenerated = (occurrence: MonthlyPlanOccurrence) =>
      !running.has(occurrence.id) && (freshIds.has(occurrence.id) || (chosenKeys.has(typeKeyOf(occurrence.typeId)) && occurrence.dutyDate >= rangeFrom && occurrence.dutyDate <= rangeUntil));
    const keptOccurrences = previousOccurrences.filter((occurrence) => !regenerated(occurrence) && !occurrenceEnded(occurrence, now));
    const keptIds = new Set(keptOccurrences.map((occurrence) => occurrence.id));
    const keptAssignments: StoredAssignment[] = previousAssignments
      .filter((item) => keptIds.has(item.occurrenceId))
      .map((item) => ({ occurrenceId: item.occurrenceId, brokerId: item.brokerId, ...(item.origin ? { origin: item.origin } : {}) }));
    const keptById = new Map(keptOccurrences.map((occurrence) => [occurrence.id, occurrence]));

    // Who is already on the real roster of each plantão being drawn: the
    // published escala (one row per date) and the weekly roster. They stay
    // and the draw only fills the remaining places (a draft is redrawn).
    const brokerIdSet = new Set(brokers.map((broker) => broker.id));
    const rosterRows = toDraw.length
      ? await tx.select({
        scheduleId: schema.dutyRosterAssignments.scheduleId,
        brokerId: schema.dutyRosterAssignments.brokerId,
        dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
        dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
        validFrom: schema.dutyRosterAssignments.validFrom,
        validUntil: schema.dutyRosterAssignments.validUntil,
      }).from(schema.dutyRosterAssignments)
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.status, "active"),
          inArray(schema.dutyRosterAssignments.scheduleId, [...new Set(toDraw.map((occurrence) => occurrence.scheduleId))]),
        ))
      : [];
    const existing: StoredAssignment[] = [];
    const existingByOccurrence = new Map<string, string[]>();
    for (const occurrence of toDraw) {
      const midnight = zonedMidnight(occurrence.dutyDate, "America/Sao_Paulo").getTime();
      const seen = new Set<string>();
      for (const row of rosterRows) {
        if (row.scheduleId !== occurrence.scheduleId || !brokerIdSet.has(row.brokerId) || seen.has(row.brokerId)) continue;
        const dated = row.dutyDate === occurrence.dutyDate;
        const weekly = row.dutyDate === null && row.dayOfWeek === dayOfWeekOf(occurrence.dutyDate)
          && row.validFrom.getTime() <= midnight && (!row.validUntil || row.validUntil.getTime() > midnight);
        if (!dated && !weekly) continue;
        seen.add(row.brokerId);
        existing.push({ occurrenceId: occurrence.id, brokerId: row.brokerId, origin: dated ? "existing" : "weekly" });
      }
      if (seen.size) existingByOccurrence.set(occurrence.id, [...seen]);
    }
    // Already on the roster = allowed on it, whatever the units of the type say.
    const drawn = toDraw.map((occurrence) => {
      const kept = existingByOccurrence.get(occurrence.id);
      return kept ? { ...occurrence, allowedBrokerIds: [...new Set([...occurrence.allowedBrokerIds, ...kept])], keptBrokerIds: kept } : occurrence;
    });

    const windowsByBroker = new Map<string, typeof windows>();
    for (const window of windows) windowsByBroker.set(window.brokerId, [...(windowsByBroker.get(window.brokerId) ?? []), window]);
    const generated = generateTypedAssignments({
      occurrences: drawn,
      settings: settingsInput,
      windowsByBroker,
      commitments: keptAssignments.map((item) => ({ brokerId: item.brokerId, ...keptById.get(item.occurrenceId)! })),
      existingByOccurrence,
    });

    const settings = mergeSettings(parsePlanSettings(latest?.settings), settingsInput);
    const occurrences = [...keptOccurrences, ...drawn].sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
    const id = randomUUID();
    await tx.insert(schema.dutyScheduleMonthlyPlans).values({
      id,
      tenantId: context.tenantId,
      monthKey,
      revision: (latest?.revision ?? 0) + 1,
      status: "draft",
      quotas: settings.brokers.map((broker) => ({ brokerId: broker.brokerId, quota: Object.values(broker.seats).reduce((sum, seats) => sum + seats, 0) })),
      occurrences,
      assignments: [...keptAssignments, ...existing, ...generated],
      settings,
      generatedBy: context.userId,
    });
    await audit(tx, context.userId, id, "duty_schedule_monthly_plan.generated");
    return id;
  });

  revalidatePath(PLANTAO_PATH);
  const view = await buildPlanView(db, context, monthKey);
  if (!view || view.id !== planId) throw new Error("A proposta foi gerada, mas não pôde ser carregada. Recarregue a página.");
  return view;
}

/** Manual adjustment of a draft: add or remove one broker from one occurrence. */
export async function updateMonthlyDutyDraftAction(input: unknown): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const { planId, occurrenceId, brokerId, operation, force } = editSchema.parse(input);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    await lockPlans(tx, context.tenantId);
    const [plan] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) throw new Error("Proposta não encontrada.");
    if (plan.status !== "draft") throw new Error("Só é possível ajustar uma proposta em rascunho.");

    let occurrences = asArray<MonthlyPlanOccurrence>(plan.occurrences);
    const current = asArray<StoredAssignment>(plan.assignments);
    let next: StoredAssignment[];
    if (operation === "remove") {
      const target = current.find((item) => item.occurrenceId === occurrenceId && item.brokerId === brokerId);
      if (!target) throw new Error("Este corretor não está neste plantão.");
      if (target.origin === "weekly") throw new Error("Este corretor está na escala semanal do plantão. Remova-o pelo próprio plantão.");
      next = current.filter((item) => item !== target);
    } else {
      const planningIds = new Set((await loadPlanningBrokers(tx, context.tenantId)).map((broker) => broker.id));
      if (!planningIds.has(brokerId)) throw new Error("Este corretor está fora da corretora ou da política de inclusão na escala.");
      const target = occurrences.find((occurrence) => occurrence.id === occurrenceId);
      if (!target) throw new Error("Este plantão não está na proposta.");
      if (occurrenceEnded(target, new Date())) throw new Error("Este plantão já terminou. Não é possível escalar corretores nele.");
      if (!target.allowedBrokerIds.includes(brokerId)) {
        if (!force) throw new Error("A unidade deste corretor não participa deste tipo de plantão. Confirme para escalar mesmo assim.");
        occurrences = occurrences.map((occurrence) => occurrence.id === occurrenceId
          ? { ...occurrence, allowedBrokerIds: [...occurrence.allowedBrokerIds, brokerId], forcedBrokerIds: [...new Set([...(occurrence.forcedBrokerIds ?? []), brokerId])] }
          : occurrence);
      }
      next = [...current, { occurrenceId, brokerId, origin: "manual" }];
      // DEC-132: an overlap with the broker's other occurrences no longer blocks the add.
      const problems = findDraftProblems(occurrences, next).filter((problem) => problem.occurrenceId === occurrenceId && problem.kind !== "overlap");
      if (problems.length) throw new Error(describeDraftProblem(problems[0]));
    }
    await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: next, occurrences, updatedAt: new Date() })
      .where(eq(schema.dutyScheduleMonthlyPlans.id, planId));
    await audit(tx, context.userId, planId, operation === "add" ? (force ? "duty_schedule_monthly_plan.broker_forced" : "duty_schedule_monthly_plan.broker_added") : "duty_schedule_monthly_plan.broker_removed");
    return plan.monthKey;
  });

  const view = await buildPlanView(db, context, monthKey);
  if (!view) throw new Error("Proposta não encontrada.");
  return view;
}

/**
 * Publishes a draft atomically: revalidates each occurrence against today's
 * plantões and brokers, writes one dated roster row per assignment (duty_date
 * + monthly_plan_id, never mixed with the weekly roster), notifies each broker
 * once and flips the plan to published.
 *
 * Running plantões are safe: a broker who already has an active dated row for
 * the same plantão and date keeps that row (presence, pause and absence stay
 * on it), it only moves to this plan. Only rows that are no longer in the
 * escala, on dates that have not ended, become inactive.
 */
export async function publishMonthlyDutyPlanAction(planIdInput: string): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const planId = z.string().uuid().parse(planIdInput);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    await lockPlans(tx, context.tenantId);
    const [plan] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) throw new Error("Proposta não encontrada.");
    if (plan.status !== "draft") throw new Error("Esta proposta não está mais em rascunho.");
    const latest = await loadLatestPlan(tx, context.tenantId, plan.monthKey);
    if (latest?.id !== planId) throw new Error("Existe uma proposta mais nova para este mês. Revise a última versão.");
    const [previous] = await tx.select({ id: schema.dutyScheduleMonthlyPlans.id }).from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, plan.monthKey), eq(schema.dutyScheduleMonthlyPlans.status, "published")))
      .limit(1);

    const storedAssignments = asArray<StoredAssignment>(plan.assignments);
    if (!storedAssignments.length) throw new Error("Não há corretores na proposta para publicar.");

    // Revalidate against today's data: the draft may be days old.
    const [brokers, schedules] = await Promise.all([loadPlanningBrokers(tx, context.tenantId), loadActiveSchedules(tx, context.tenantId)]);
    const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const now = new Date();
    const occurrences: MonthlyPlanOccurrence[] = [];
    const endedIds = new Set<string>();
    const staleIds = new Set<string>();
    let changed = false;
    for (const stored of asArray<MonthlyPlanOccurrence>(plan.occurrences)) {
      if (occurrenceEnded(stored, now)) { endedIds.add(stored.id); continue; }
      const schedule = scheduleById.get(stored.scheduleId);
      const [rebuilt] = schedule ? buildRangeOccurrences(stored.dutyDate, stored.dutyDate, [schedule], brokers) : [];
      // The plantão was removed, deactivated or moved to another date: that date is left out.
      if (!rebuilt) { staleIds.add(stored.id); continue; }
      if (rebuilt.startsAt !== stored.startsAt || rebuilt.endsAt !== stored.endsAt) changed = true;
      // Brokers the Diretor confirmed outside the type's units stay allowed.
      const forced = (stored.forcedBrokerIds ?? []).filter((brokerId) => brokers.some((broker) => broker.id === brokerId));
      const kept = (stored.keptBrokerIds ?? []).filter((brokerId) => brokers.some((broker) => broker.id === brokerId));
      occurrences.push({
        ...rebuilt,
        allowedBrokerIds: [...new Set([...rebuilt.allowedBrokerIds, ...forced, ...kept])],
        forcedBrokerIds: forced.length ? forced : undefined,
        keptBrokerIds: kept.length ? kept : undefined,
      });
    }
    // A draft can be days old: shifts that ended since then are dropped, never published.
    const assignments = storedAssignments.filter((assignment) => !endedIds.has(assignment.occurrenceId) && !staleIds.has(assignment.occurrenceId));
    if (staleIds.size) await audit(tx, context.userId, planId, `duty_schedule_monthly_plan.stale_dropped:${staleIds.size}`);
    if (!assignments.length) {
      throw new Error(staleIds.size
        ? "Os plantões desta proposta não existem mais (removidos, inativos ou com outra data). Gere uma nova proposta."
        : "Todos os plantões desta proposta já passaram. Gere uma nova proposta.");
    }
    // DEC-132: an overlap is a warning, never a publish blocker.
    // Weekly roster brokers are not published (no dated row): only the rest is revalidated.
    const problems = findDraftProblems(occurrences, assignments.filter((assignment) => assignment.origin !== "weekly")).filter((problem) => problem.kind !== "overlap");
    if (changed || problems.length) {
      throw new Error(`A proposta ficou desatualizada: ${changed ? "o horário de um plantão mudou." : describeDraftProblem(problems[0])} Gere uma nova proposta.`);
    }

    const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
    const brokerById = new Map(brokers.map((broker) => [broker.id, broker]));
    const dates = [...new Set(occurrences.map((occurrence) => occurrence.dutyDate))];

    // Active dated rows this publication may replace: the previous escala of
    // the month, and any other escala's rows on these plantões and dates
    // (an escala that ran into this month).
    const candidates = await tx.select({
      id: schema.dutyRosterAssignments.id,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      brokerId: schema.dutyRosterAssignments.brokerId,
      monthlyPlanId: schema.dutyRosterAssignments.monthlyPlanId,
      dutyDate: sql<string>`${schema.dutyRosterAssignments.dutyDate}::text`,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
    }).from(schema.dutyRosterAssignments)
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNotNull(schema.dutyRosterAssignments.dutyDate),
        isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
        ne(schema.dutyRosterAssignments.monthlyPlanId, planId),
        previous
          ? or(eq(schema.dutyRosterAssignments.monthlyPlanId, previous.id), inArray(schema.dutyRosterAssignments.dutyDate, dates))
          : inArray(schema.dutyRosterAssignments.dutyDate, dates),
      ));
    const replaceable = candidates.filter((row) =>
      !occurrenceEnded({ dutyDate: row.dutyDate, startsAt: row.startsAt, endsAt: row.endsAt }, now)
      && (row.monthlyPlanId === previous?.id || occurrenceById.has(`${row.scheduleId}:${row.dutyDate}`)));
    const existingByKey = new Map(replaceable.map((row) => [`${row.scheduleId}:${row.dutyDate}|${row.brokerId}`, row]));

    const kept: Array<{ assignment: StoredAssignment; rowId: string }> = [];
    const inserts: Array<typeof schema.dutyRosterAssignments.$inferInsert> = [];
    const insertedFor: StoredAssignment[] = [];
    for (const assignment of assignments) {
      // Weekly roster brokers are already on duty (weekly and published add up): no dated row.
      if (assignment.origin === "weekly") continue;
      const existing = existingByKey.get(`${assignment.occurrenceId}|${assignment.brokerId}`);
      if (existing) {
        kept.push({ assignment, rowId: existing.id });
        existingByKey.delete(`${assignment.occurrenceId}|${assignment.brokerId}`);
        continue;
      }
      const occurrence = occurrenceById.get(assignment.occurrenceId)!;
      const schedule = scheduleById.get(occurrence.scheduleId)!;
      const validity = occurrenceValidity(occurrence.dutyDate, schedule.timezone);
      inserts.push({
        id: randomUUID(),
        tenantId: context.tenantId,
        branchId: brokerById.get(assignment.brokerId)!.branchId,
        scheduleId: occurrence.scheduleId,
        brokerId: assignment.brokerId,
        dayOfWeek: dayOfWeekOf(occurrence.dutyDate),
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        validFrom: validity.validFrom,
        validUntil: validity.validUntil,
        dutyDate: occurrence.dutyDate,
        monthlyPlanId: planId,
        status: "active",
        createdBy: context.userId,
        updatedBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      insertedFor.push(assignment);
    }
    // What is left was on the previous escala but is not in this draft. Only the
    // plantões this generation redrew (chosen types, inside the period, not started)
    // leave the roster. Everything else stays active: a broker placed by hand, or on a
    // type nobody redrew, is still on duty after the publication.
    const draftRange = planRange(plan, occurrences);
    const decision = decideLeftoverRows({
      leftovers: [...existingByKey.values()].map((row) => ({ id: row.id, scheduleId: row.scheduleId, brokerId: row.brokerId, dutyDate: row.dutyDate, startsAt: row.startsAt, monthlyPlanId: row.monthlyPlanId })),
      draftOccurrenceIds: new Set(occurrences.map((occurrence) => occurrence.id)),
      generatedTypeKeys: parsePlanSettings(plan.settings)?.generatedTypeKeys ?? null,
      rangeFrom: draftRange.rangeFrom,
      rangeUntil: draftRange.rangeUntil,
      typeKeyOfSchedule: (scheduleId) => typeKeyOf(scheduleById.get(scheduleId)?.typeId),
      started: (row) => occurrenceStarted({ dutyDate: row.dutyDate, startsAt: row.startsAt }, now),
      occurrenceIdOf,
    });
    if (decision.removeIds.length) {
      await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: now })
        .where(inArray(schema.dutyRosterAssignments.id, decision.removeIds));
    }
    // Kept rows of a plantão the draft lists go back into the escala (origin existing) and onto this plan.
    const preservedInDraft = decision.preserved.filter((item) => item.occurrenceId !== null);
    if (preservedInDraft.length) {
      await tx.update(schema.dutyRosterAssignments).set({ monthlyPlanId: planId, updatedBy: context.userId, updatedAt: now })
        .where(inArray(schema.dutyRosterAssignments.id, preservedInDraft.map((item) => item.row.id)));
    }
    const preservedAssignments: StoredAssignment[] = preservedInDraft.map((item) => ({
      occurrenceId: item.occurrenceId!,
      brokerId: item.row.brokerId,
      origin: "existing",
      rosterAssignmentId: item.row.id,
    }));
    if (kept.length) {
      await tx.update(schema.dutyRosterAssignments).set({ monthlyPlanId: planId, updatedBy: context.userId, updatedAt: now })
        .where(inArray(schema.dutyRosterAssignments.id, kept.map((item) => item.rowId)));
    }
    if (previous) {
      await tx.update(schema.dutyScheduleMonthlyPlans).set({ status: "superseded", updatedAt: now })
        .where(eq(schema.dutyScheduleMonthlyPlans.id, previous.id));
      await audit(tx, context.userId, previous.id, "duty_schedule_monthly_plan.superseded");
    }
    if (inserts.length) await tx.insert(schema.dutyRosterAssignments).values(inserts);

    const rowIdByAssignment = new Map<StoredAssignment, string>([
      ...kept.map((item) => [item.assignment, item.rowId] as const),
      ...insertedFor.map((assignment, index) => [assignment, inserts[index].id!] as const),
    ]);
    const [flipped] = await tx.update(schema.dutyScheduleMonthlyPlans).set({
      status: "published",
      assignments: [...assignments.map((assignment) => ({ occurrenceId: assignment.occurrenceId, brokerId: assignment.brokerId, origin: assignment.origin, rosterAssignmentId: rowIdByAssignment.get(assignment) })), ...preservedAssignments],
      occurrences,
      publishedBy: context.userId,
      publishedAt: now,
      updatedAt: now,
    }).where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.status, "draft")))
      .returning({ id: schema.dutyScheduleMonthlyPlans.id });
    if (!flipped) throw new Error("Esta proposta foi publicada por outra pessoa.");
    await audit(tx, context.userId, planId, "duty_schedule_monthly_plan.published");

    const counts = new Map<string, number>();
    for (const assignment of [...assignments, ...preservedAssignments]) counts.set(assignment.brokerId, (counts.get(assignment.brokerId) ?? 0) + 1);
    const { rangeFrom, rangeUntil } = planRange(plan, occurrences);
    const short = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
    for (const [brokerId, count] of counts) {
      await tx.insert(schema.notifications).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        recipientUserId: brokerId,
        type: "duty_schedule_published",
        title: "Sua escala de plantões foi publicada",
        message: `Você tem ${count} plantão${count === 1 ? "" : "ões"} entre ${short(rangeFrom)} e ${short(rangeUntil)}. Confira em Minha fila.`,
        idempotencyKey: `duty-month:${planId}:${brokerId}`,
        createdAt: now,
      }).onConflictDoNothing();
    }
    return plan.monthKey;
  });

  revalidatePath(PLANTAO_PATH);
  revalidatePath("/minha-fila");
  const view = await buildPlanView(db, context, monthKey);
  if (!view) throw new Error("Escala publicada, mas não pôde ser carregada. Recarregue a página.");
  return view;
}


// ─── Published escala: add or remove one broker on one plantão, without a new revision ───

const publishedEditSchema = z.object({
  occurrenceId: z.string().min(1).max(120),
  brokerId: z.string().min(1),
  /** Schedule a broker outside the plantão's unit (the Diretor confirmed). */
  force: z.boolean().optional(),
});

/** Occurrence ids are `${scheduleId}:${dutyDate}`. */
const dutyDateOfOccurrence = (targetId: string) => targetId.slice(-10);

function previousMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

/**
 * The PUBLISHED escala that holds this plantão (its own month, or the previous one
 * when that escala runs into this month) and the newer draft of that escala, if any.
 * The change goes to the published escala: its list and its dated row. A newer draft
 * gets the same change, so the people shown there are the same until it is published.
 */
async function loadPublishedOccurrence(tx: Transaction, tenantId: string, targetId: string) {
  const dutyDate = dutyDateOfOccurrence(targetId);
  const monthKey = dutyDate.slice(0, 7);
  const candidates = await tx.select().from(schema.dutyScheduleMonthlyPlans)
    .where(and(
      eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantId),
      eq(schema.dutyScheduleMonthlyPlans.status, "published"),
      inArray(schema.dutyScheduleMonthlyPlans.monthKey, [monthKey, previousMonthKey(monthKey)]),
    ))
    .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision));
  const plan = candidates.find((item) => asArray<MonthlyPlanOccurrence>(item.occurrences).some((occurrence) => occurrence.id === targetId));
  if (!plan) throw new Error("Este plantão não está na escala publicada.");
  const occurrence = asArray<MonthlyPlanOccurrence>(plan.occurrences).find((item) => item.id === targetId)!;
  const latest = await loadLatestPlan(tx, tenantId, plan.monthKey);
  const draft = latest && latest.status === "draft" && latest.revision > plan.revision ? latest : null;
  return { plan, occurrence, assignments: asArray<StoredAssignment>(plan.assignments), draft };
}

/** In-app notification to a broker about a change on his plantão (no WhatsApp). */
async function notifyPlantaoChange(tx: Transaction, input: {
  tenantId: string;
  brokerId: string;
  kind: "added" | "removed";
  occurrence: MonthlyPlanOccurrence;
  scheduleName: string;
  /** The dated roster row that changed state. */
  rosterId: string;
  now: Date;
}) {
  const day = `${input.occurrence.dutyDate.slice(8, 10)}/${input.occurrence.dutyDate.slice(5, 7)}`;
  const slot = `das ${input.occurrence.startsAt.slice(0, 5)} às ${input.occurrence.endsAt.slice(0, 5)}`;
  const added = input.kind === "added";
  // One notification per real transition: the row, the kind and the moment of the change (the row's updatedAt is the same instant).
  // Repeating a click changes nothing, so it is refused before this point; a retry of the same write hits the unique key.
  await tx.insert(schema.notifications).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    recipientUserId: input.brokerId,
    type: added ? "duty_plantao_added" : "duty_plantao_removed",
    title: added ? "Você foi escalado num plantão" : "Você saiu de um plantão",
    message: added
      ? `Você está escalado no plantão ${input.scheduleName}, em ${day}, ${slot}.`
      : `Você saiu do plantão ${input.scheduleName}, em ${day}, ${slot}.`,
    idempotencyKey: `duty-direct:${input.kind}:${input.occurrence.id}:${input.brokerId}:${input.rosterId}:${input.now.getTime()}`,
    createdAt: input.now,
  }).onConflictDoNothing();
}

/** Adds a broker to a plantão of the published escala. The dated row is written now; no new revision. */
export async function addBrokerToPublishedOccurrenceAction(input: unknown): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const { occurrenceId: targetId, brokerId, force } = publishedEditSchema.parse(input);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    await lockPlans(tx, context.tenantId);
    const { plan, occurrence, assignments, draft } = await loadPublishedOccurrence(tx, context.tenantId, targetId);
    const now = new Date();
    const schedule = (await loadActiveSchedules(tx, context.tenantId)).find((item) => item.id === occurrence.scheduleId) ?? null;
    const broker = (await loadPlanningBrokers(tx, context.tenantId)).find((item) => item.id === brokerId) ?? null;
    // Weekly roster: the broker is already on this plantão every week if a weekly row covers the day.
    const dayMidnight = zonedMidnight(occurrence.dutyDate, "America/Sao_Paulo").getTime();
    const weeklyRows = await tx.select({ id: schema.dutyRosterAssignments.id, validFrom: schema.dutyRosterAssignments.validFrom, validUntil: schema.dutyRosterAssignments.validUntil })
      .from(schema.dutyRosterAssignments)
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.scheduleId, occurrence.scheduleId),
        eq(schema.dutyRosterAssignments.brokerId, brokerId),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNull(schema.dutyRosterAssignments.dutyDate),
        eq(schema.dutyRosterAssignments.dayOfWeek, dayOfWeekOf(occurrence.dutyDate)),
      ));
    const onWeeklyRoster = weeklyRows.some((row) => row.validFrom.getTime() <= dayMidnight && (!row.validUntil || row.validUntil.getTime() > dayMidnight));
    const allowed = occurrence.allowedBrokerIds.includes(brokerId);
    const problem = publishedAddProblem({
      ended: occurrenceEnded(occurrence, now),
      brokerIsPlanningBroker: Boolean(broker),
      alreadyOnPlantao: assignments.some((item) => item.occurrenceId === targetId && item.brokerId === brokerId),
      allowedInType: allowed,
      force: Boolean(force),
      scheduleActive: Boolean(schedule),
      onWeeklyRoster,
    });
    if (problem) throw new Error(problem);
    if (!broker || !schedule) throw new Error("Este plantão ou corretor não está disponível para a escala.");

    // The broker's dated row for this plantão: an active one is adopted by this plan, an inactive one comes back, otherwise a row is created.
    const [row] = await tx.select({ id: schema.dutyRosterAssignments.id })
      .from(schema.dutyRosterAssignments)
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.scheduleId, occurrence.scheduleId),
        eq(schema.dutyRosterAssignments.brokerId, brokerId),
        eq(schema.dutyRosterAssignments.dutyDate, occurrence.dutyDate),
      ))
      .orderBy(desc(schema.dutyRosterAssignments.status))
      .limit(1);
    let rosterId: string;
    if (row) {
      rosterId = row.id;
      await tx.update(schema.dutyRosterAssignments).set({ status: "active", monthlyPlanId: plan.id, updatedBy: context.userId, updatedAt: now })
        .where(eq(schema.dutyRosterAssignments.id, row.id));
    } else {
      rosterId = randomUUID();
      const validity = occurrenceValidity(occurrence.dutyDate, schedule.timezone);
      await tx.insert(schema.dutyRosterAssignments).values({
        id: rosterId,
        tenantId: context.tenantId,
        branchId: broker.branchId,
        scheduleId: occurrence.scheduleId,
        brokerId,
        dayOfWeek: dayOfWeekOf(occurrence.dutyDate),
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        validFrom: validity.validFrom,
        validUntil: validity.validUntil,
        dutyDate: occurrence.dutyDate,
        monthlyPlanId: plan.id,
        status: "active",
        createdBy: context.userId,
        updatedBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    const entry: StoredAssignment = { occurrenceId: targetId, brokerId, origin: "manual", rosterAssignmentId: rosterId };
    const withBroker = (item: MonthlyPlanOccurrence) => (item.id === targetId && !item.allowedBrokerIds.includes(brokerId)
      ? { ...item, allowedBrokerIds: [...item.allowedBrokerIds, brokerId], forcedBrokerIds: [...new Set([...(item.forcedBrokerIds ?? []), brokerId])] }
      : item);
    await tx.update(schema.dutyScheduleMonthlyPlans).set({
      assignments: [...assignments, entry],
      occurrences: asArray<MonthlyPlanOccurrence>(plan.occurrences).map(withBroker),
      updatedAt: now,
    }).where(eq(schema.dutyScheduleMonthlyPlans.id, plan.id));

    // A newer draft that still lists this plantão shows the same person (no duplicate).
    if (draft) {
      const draftOccurrence = asArray<MonthlyPlanOccurrence>(draft.occurrences).find((item) => item.id === targetId);
      const draftAssignments = asArray<StoredAssignment>(draft.assignments);
      if (draftOccurrence && !occurrenceEnded(draftOccurrence, now) && !draftAssignments.some((item) => item.occurrenceId === targetId && item.brokerId === brokerId)) {
        await tx.update(schema.dutyScheduleMonthlyPlans).set({
          assignments: [...draftAssignments, entry],
          occurrences: asArray<MonthlyPlanOccurrence>(draft.occurrences).map(withBroker),
          updatedAt: now,
        }).where(eq(schema.dutyScheduleMonthlyPlans.id, draft.id));
      }
    }
    await audit(tx, context.userId, plan.id, !allowed ? "duty_schedule_monthly_plan.published_broker_forced" : "duty_schedule_monthly_plan.published_broker_added");
    await notifyPlantaoChange(tx, { tenantId: context.tenantId, brokerId, kind: "added", occurrence, scheduleName: schedule.name, rosterId, now });
    return plan.monthKey;
  });

  revalidatePath(PLANTAO_PATH);
  revalidatePath("/minha-fila");
  const view = await buildPlanView(db, context, monthKey);
  if (!view) throw new Error("Proposta não encontrada.");
  return view;
}

/** Removes a broker from a plantão of the published escala: the dated row leaves the roster now; no new revision. */
export async function removeBrokerFromPublishedOccurrenceAction(input: unknown): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const { occurrenceId: targetId, brokerId } = publishedEditSchema.parse(input);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    await lockPlans(tx, context.tenantId);
    const { plan, occurrence, assignments, draft } = await loadPublishedOccurrence(tx, context.tenantId, targetId);
    const now = new Date();
    const entry = assignments.find((item) => item.occurrenceId === targetId && item.brokerId === brokerId);
    const problem = publishedRemoveProblem({
      entryFound: Boolean(entry),
      origin: entry?.origin,
      ended: occurrenceEnded(occurrence, now),
      started: occurrenceStarted(occurrence, now),
    });
    if (problem) throw new Error(problem);
    const scheduleName = (await tx.select({ name: schema.unitDutySchedules.name }).from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), eq(schema.unitDutySchedules.id, occurrence.scheduleId))).limit(1))[0]?.name ?? "plantão";

    await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: now })
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
        eq(schema.dutyRosterAssignments.scheduleId, occurrence.scheduleId),
        eq(schema.dutyRosterAssignments.brokerId, brokerId),
        eq(schema.dutyRosterAssignments.dutyDate, occurrence.dutyDate),
        eq(schema.dutyRosterAssignments.status, "active"),
        eq(schema.dutyRosterAssignments.monthlyPlanId, plan.id),
      ));
    await tx.update(schema.dutyScheduleMonthlyPlans).set({
      assignments: assignments.filter((item) => item !== entry),
      updatedAt: now,
    }).where(eq(schema.dutyScheduleMonthlyPlans.id, plan.id));
    if (draft) {
      const draftAssignments = asArray<StoredAssignment>(draft.assignments);
      if (draftAssignments.some((item) => item.occurrenceId === targetId && item.brokerId === brokerId)) {
        await tx.update(schema.dutyScheduleMonthlyPlans).set({
          assignments: draftAssignments.filter((item) => !(item.occurrenceId === targetId && item.brokerId === brokerId)),
          updatedAt: now,
        }).where(eq(schema.dutyScheduleMonthlyPlans.id, draft.id));
      }
    }
    await audit(tx, context.userId, plan.id, "duty_schedule_monthly_plan.published_broker_removed");
    await notifyPlantaoChange(tx, { tenantId: context.tenantId, brokerId, kind: "removed", occurrence, scheduleName, rosterId: entry?.rosterAssignmentId ?? "sem-linha", now });
    return plan.monthKey;
  });

  revalidatePath(PLANTAO_PATH);
  revalidatePath("/minha-fila");
  const view = await buildPlanView(db, context, monthKey);
  if (!view) throw new Error("Proposta não encontrada.");
  return view;
}
