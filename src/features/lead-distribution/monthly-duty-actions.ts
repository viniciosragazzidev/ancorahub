"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getRequiredTenantContext, type TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { generateDutyScheduleDraft } from "./duty-scheduling-engine";
import { getRosterBrokerAccountFilter } from "./roster-broker-account-filter";
import {
  buildMonthOccurrences,
  dayOfWeekOf,
  describeDraftProblem,
  findDraftProblems,
  MONTH_KEY_PATTERN,
  occurrenceValidity,
  shiftEnd,
  summarizeDraft,
  type MonthlyPlanAssignment,
  type MonthlyPlanOccurrence,
} from "./monthly-duty-plan";

type Database = ReturnType<typeof getDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const monthSchema = z.string().regex(MONTH_KEY_PATTERN);
const quotasSchema = z.array(z.object({ brokerId: z.string().min(1), quota: z.coerce.number().int().min(0).max(31) })).max(500);
const editSchema = z.object({
  planId: z.string().uuid(),
  occurrenceId: z.string().min(1).max(120),
  brokerId: z.string().min(1),
  operation: z.enum(["add", "remove"]),
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

/** Plantões are global (DEC-110): only the Director plans, edits and publishes the month. */
async function writeScope() {
  const context = await readScope();
  if (context.role !== "director") throw new Error("Apenas o Diretor pode montar e publicar a escala mensal.");
  if ((await getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING)) !== "true") throw new Error("A escala mensal está desativada pelo Super-admin.");
  return context;
}

/** Serialises every write on one tenant/month (generate, edit, publish). */
async function lockMonth(tx: Transaction, tenantId: string, monthKey: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${`duty-month:${monthKey}`}))`);
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
  return db.select({
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
  }).from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), eq(schema.unitDutySchedules.status, "active")));
}

async function loadLatestPlan(db: Executor, tenantId: string, monthKey: string) {
  const [plan] = await db.select().from(schema.dutyScheduleMonthlyPlans)
    .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey)))
    .orderBy(desc(schema.dutyScheduleMonthlyPlans.revision))
    .limit(1);
  return plan ?? null;
}

const asArray = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : []);

/** Stored occurrences carry no time zone; plantões run on São Paulo time. */
function occurrenceEnded(occurrence: Pick<MonthlyPlanOccurrence, "dutyDate" | "startsAt" | "endsAt">, now: Date) {
  return shiftEnd({ ...occurrence, timezone: "America/Sao_Paulo" }, occurrence.dutyDate).getTime() <= now.getTime();
}

async function audit(db: Executor, userId: string, planId: string, acao: string) {
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "duty_schedule_monthly_plan", entidadeId: planId, acao });
}

/** View model of a month for the planner; Managers only see their unit's brokers. */
async function buildPlanView(db: Executor, context: TenantContext, monthKey: string) {
  const plan = await loadLatestPlan(db, context.tenantId, monthKey);
  if (!plan) return null;
  const occurrences = asArray<MonthlyPlanOccurrence>(plan.occurrences);
  const allAssignments = asArray<StoredAssignment>(plan.assignments);
  const quotas = asArray<StoredQuota>(plan.quotas);
  const brokerIds = [...new Set([...allAssignments.map((item) => item.brokerId), ...quotas.map((item) => item.brokerId)])];
  const people = brokerIds.length
    ? await db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
      .from(schema.user)
      .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
      .where(inArray(schema.user.id, brokerIds))
    : [];
  const person = new Map(people.map((row) => [row.id, row]));
  const visible = (brokerId: string) => context.role !== "manager" || person.get(brokerId)?.branchId === context.branchId;
  const assignments = allAssignments.filter((item) => visible(item.brokerId));
  const visibleQuotas = quotas.filter((item) => visible(item.brokerId));
  const summary = summarizeDraft(occurrences, allAssignments, new Map(visibleQuotas.map((item) => [item.brokerId, item.quota])));
  const problems = plan.status === "draft" ? findDraftProblems(occurrences, allAssignments) : [];
  const now = new Date();
  const [publishedBefore] = plan.status === "draft"
    ? await db.select({ id: schema.dutyScheduleMonthlyPlans.id }).from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, monthKey), eq(schema.dutyScheduleMonthlyPlans.status, "published")))
      .limit(1)
    : [];
  return {
    id: plan.id,
    monthKey: plan.monthKey,
    revision: plan.revision,
    status: plan.status as "draft" | "published",
    publishedAt: plan.publishedAt?.toISOString() ?? null,
    quotas: visibleQuotas.map((item) => ({ ...item, assigned: summary.assignedByBroker.get(item.brokerId) ?? 0 })),
    occurrences: occurrences.map((occurrence) => ({
      ...occurrence,
      brokers: assignments.filter((item) => item.occurrenceId === occurrence.id).map((item) => ({ id: item.brokerId, name: person.get(item.brokerId)?.name ?? "Corretor" })),
      assignedCount: summary.assignedByOccurrence.get(occurrence.id) ?? 0,
      /** Shift already over: read-only in a draft and never published. */
      ended: occurrenceEnded(occurrence, now),
    })),
    totalAssigned: allAssignments.length,
    belowMinimum: summary.belowMinimum,
    missingQuota: summary.missingQuota,
    problems: [...new Set(problems.map(describeDraftProblem))],
    canEdit: context.role === "director",
    /** Publishing this draft replaces a published escala on the dates that have not ended. */
    replacesPublished: Boolean(publishedBefore),
  };
}

export type MonthlyDutyPlanView = NonNullable<Awaited<ReturnType<typeof buildPlanView>>>;

export async function getMonthlyDutyPlanAction(monthKeyInput: string): Promise<MonthlyDutyPlanView | null> {
  const context = await readScope();
  return buildPlanView(getDatabase(), context, monthSchema.parse(monthKeyInput));
}

/** `scheduleIds`: plantões chosen for the month (all active ones when omitted). */
export async function generateMonthlyDutyPlanAction(input: { monthKey: string; quotas: unknown; scheduleIds?: string[] }): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const monthKey = monthSchema.parse(input.monthKey);
  const quotas = quotasSchema.parse(input.quotas);
  const chosen = input.scheduleIds === undefined ? null : new Set(z.array(z.string().uuid()).max(200).parse(input.scheduleIds));
  const db = getDatabase();

  const planId = await db.transaction(async (tx) => {
    await lockMonth(tx, context.tenantId, monthKey);
    const latest = await loadLatestPlan(tx, context.tenantId, monthKey);
    // A published month can be staffed again: the new revision replaces, on
    // publication, only the dates that have not ended yet.

    const [brokers, schedules, windows] = await Promise.all([
      loadPlanningBrokers(tx, context.tenantId),
      loadActiveSchedules(tx, context.tenantId),
      tx.select({ brokerId: schema.brokerAvailabilityWindows.brokerId, dayOfWeek: schema.brokerAvailabilityWindows.dayOfWeek, startsAt: schema.brokerAvailabilityWindows.startsAt, endsAt: schema.brokerAvailabilityWindows.endsAt })
        .from(schema.brokerAvailabilityWindows)
        .where(eq(schema.brokerAvailabilityWindows.tenantId, context.tenantId)),
    ]);
    const brokerIds = new Set(brokers.map((broker) => broker.id));
    if (new Set(quotas.map((item) => item.brokerId)).size !== quotas.length || quotas.some((item) => !brokerIds.has(item.brokerId))) {
      throw new Error("A cota contém corretor fora da corretora ou da política de inclusão na escala. Recarregue a página.");
    }
    // Only shifts that have not ended yet: a past plantão is never staffed.
    const occurrences = buildMonthOccurrences(monthKey, chosen ? schedules.filter((schedule) => chosen.has(schedule.id)) : schedules, brokers, { from: new Date() });
    if (!occurrences.length) throw new Error(chosen ? "Escolha ao menos um plantão que ainda vá acontecer neste mês." : "Nenhum plantão ativo ainda vai acontecer neste mês.");

    const quotaMap = new Map(quotas.map((item) => [item.brokerId, item.quota]));
    const windowsByBroker = new Map<string, typeof windows>();
    for (const window of windows) windowsByBroker.set(window.brokerId, [...(windowsByBroker.get(window.brokerId) ?? []), window]);
    const result = generateDutyScheduleDraft(
      brokers.map((broker) => ({ id: broker.id, quota: quotaMap.get(broker.id) ?? 0, availabilityWindows: windowsByBroker.get(broker.id) ?? [] })),
      occurrences,
    );

    const id = randomUUID();
    await tx.insert(schema.dutyScheduleMonthlyPlans).values({
      id,
      tenantId: context.tenantId,
      monthKey,
      revision: (latest?.revision ?? 0) + 1,
      status: "draft",
      quotas: brokers.map((broker) => ({ brokerId: broker.id, quota: quotaMap.get(broker.id) ?? 0 })),
      occurrences,
      assignments: result.assignments,
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
  const { planId, occurrenceId, brokerId, operation } = editSchema.parse(input);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) throw new Error("Proposta não encontrada.");
    await lockMonth(tx, context.tenantId, plan.monthKey);
    const [fresh] = await tx.select({ status: schema.dutyScheduleMonthlyPlans.status, assignments: schema.dutyScheduleMonthlyPlans.assignments })
      .from(schema.dutyScheduleMonthlyPlans).where(eq(schema.dutyScheduleMonthlyPlans.id, planId)).limit(1);
    if (fresh?.status !== "draft") throw new Error("Só é possível ajustar uma proposta em rascunho.");

    const occurrences = asArray<MonthlyPlanOccurrence>(plan.occurrences);
    const current = asArray<StoredAssignment>(fresh.assignments);
    let next: StoredAssignment[];
    if (operation === "remove") {
      next = current.filter((item) => !(item.occurrenceId === occurrenceId && item.brokerId === brokerId));
      if (next.length === current.length) throw new Error("Este corretor não está neste plantão.");
    } else {
      const planningIds = new Set((await loadPlanningBrokers(tx, context.tenantId)).map((broker) => broker.id));
      if (!planningIds.has(brokerId)) throw new Error("Este corretor está fora da corretora ou da política de inclusão na escala.");
      const target = occurrences.find((occurrence) => occurrence.id === occurrenceId);
      if (target && occurrenceEnded(target, new Date())) throw new Error("Este plantão já terminou. Não é possível escalar corretores nele.");
      next = [...current, { occurrenceId, brokerId }];
      const problems = findDraftProblems(occurrences, next).filter((problem) => problem.occurrenceId === occurrenceId);
      if (problems.length) throw new Error(describeDraftProblem(problems[0]));
    }
    await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: next, updatedAt: new Date() })
      .where(eq(schema.dutyScheduleMonthlyPlans.id, planId));
    await audit(tx, context.userId, planId, operation === "add" ? "duty_schedule_monthly_plan.broker_added" : "duty_schedule_monthly_plan.broker_removed");
    return plan.monthKey;
  });

  const view = await buildPlanView(db, context, monthKey);
  if (!view) throw new Error("Proposta não encontrada.");
  return view;
}

/**
 * Publishes a draft atomically: revalidates it against today's plantões and
 * brokers, writes one dated roster row per assignment (duty_date +
 * monthly_plan_id, never mixed with the weekly roster), notifies each broker
 * once and flips the plan to published. Idempotent per plan and per month.
 */
export async function publishMonthlyDutyPlanAction(planIdInput: string): Promise<MonthlyDutyPlanView> {
  const context = await writeScope();
  const planId = z.string().uuid().parse(planIdInput);
  const db = getDatabase();

  const monthKey = await db.transaction(async (tx) => {
    const [plan] = await tx.select().from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId)))
      .limit(1);
    if (!plan) throw new Error("Proposta não encontrada.");
    await lockMonth(tx, context.tenantId, plan.monthKey);

    const [previous] = await tx.select({ id: schema.dutyScheduleMonthlyPlans.id }).from(schema.dutyScheduleMonthlyPlans)
      .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId), eq(schema.dutyScheduleMonthlyPlans.monthKey, plan.monthKey), eq(schema.dutyScheduleMonthlyPlans.status, "published")))
      .limit(1);
    const [fresh] = await tx.select({ status: schema.dutyScheduleMonthlyPlans.status, assignments: schema.dutyScheduleMonthlyPlans.assignments })
      .from(schema.dutyScheduleMonthlyPlans).where(eq(schema.dutyScheduleMonthlyPlans.id, planId)).limit(1);
    if (fresh?.status !== "draft") throw new Error("Esta proposta não está mais em rascunho.");
    const latest = await loadLatestPlan(tx, context.tenantId, plan.monthKey);
    if (latest?.id !== planId) throw new Error("Existe uma proposta mais nova para este mês. Revise a última versão.");

    const storedAssignments = asArray<StoredAssignment>(fresh.assignments);
    if (!storedAssignments.length) throw new Error("Não há corretores na proposta para publicar.");

    // Revalidate against today's data: the draft may be days old.
    const [brokers, schedules] = await Promise.all([loadPlanningBrokers(tx, context.tenantId), loadActiveSchedules(tx, context.tenantId)]);
    const stored = new Map(asArray<MonthlyPlanOccurrence>(plan.occurrences).map((occurrence) => [occurrence.id, occurrence]));
    // Only the plantões chosen for this draft.
    const draftScheduleIds = new Set([...stored.values()].map((occurrence) => occurrence.scheduleId));
    const draftSchedules = schedules.filter((schedule) => draftScheduleIds.has(schedule.id));
    const now = new Date();
    // A draft can be days old: shifts that ended since then are dropped, never published.
    const occurrences = buildMonthOccurrences(plan.monthKey, draftSchedules, brokers, { from: now });
    const upcomingIds = new Set(occurrences.map((occurrence) => occurrence.id));
    const endedIds = new Set(buildMonthOccurrences(plan.monthKey, draftSchedules, brokers).map((occurrence) => occurrence.id).filter((id) => !upcomingIds.has(id)));
    const assignments = storedAssignments.filter((assignment) => !endedIds.has(assignment.occurrenceId));
    if (!assignments.length) throw new Error("Todos os plantões desta proposta já passaram. Gere uma nova proposta.");
    const changed = occurrences.some((occurrence) => {
      const before = stored.get(occurrence.id);
      return before && (before.startsAt !== occurrence.startsAt || before.endsAt !== occurrence.endsAt);
    });
    const problems = findDraftProblems(occurrences, assignments);
    if (changed || problems.length) {
      throw new Error(`A proposta ficou desatualizada: ${changed ? "o horário de um plantão mudou." : describeDraftProblem(problems[0])} Gere uma nova proposta.`);
    }

    const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
    const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const brokerById = new Map(brokers.map((broker) => [broker.id, broker]));
    const rows = assignments.map((assignment) => {
      const occurrence = occurrenceById.get(assignment.occurrenceId)!;
      const schedule = scheduleById.get(occurrence.scheduleId)!;
      const validity = occurrenceValidity(occurrence.dutyDate, schedule.timezone);
      return {
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
      };
    });
    if (previous) {
      // The escala published before keeps the dates that already ended (history);
      // every date still ahead, or running now, passes to this revision.
      const previousRows = await tx.select({
        id: schema.dutyRosterAssignments.id,
        dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
        startsAt: schema.dutyRosterAssignments.startsAt,
        endsAt: schema.dutyRosterAssignments.endsAt,
      }).from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.monthlyPlanId, previous.id), eq(schema.dutyRosterAssignments.status, "active")));
      const replaced = previousRows
        .filter((row) => row.dutyDate && !occurrenceEnded({ dutyDate: row.dutyDate, startsAt: row.startsAt, endsAt: row.endsAt }, now))
        .map((row) => row.id);
      if (replaced.length) {
        await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: now })
          .where(inArray(schema.dutyRosterAssignments.id, replaced));
      }
      await tx.update(schema.dutyScheduleMonthlyPlans).set({ status: "superseded", updatedAt: now })
        .where(eq(schema.dutyScheduleMonthlyPlans.id, previous.id));
      await audit(tx, context.userId, previous.id, "duty_schedule_monthly_plan.superseded");
    }
    await tx.insert(schema.dutyRosterAssignments).values(rows);

    const [flipped] = await tx.update(schema.dutyScheduleMonthlyPlans).set({
      status: "published",
      assignments: assignments.map((assignment, index) => ({ occurrenceId: assignment.occurrenceId, brokerId: assignment.brokerId, rosterAssignmentId: rows[index].id })),
      occurrences,
      publishedBy: context.userId,
      publishedAt: now,
      updatedAt: now,
    }).where(and(eq(schema.dutyScheduleMonthlyPlans.id, planId), eq(schema.dutyScheduleMonthlyPlans.status, "draft")))
      .returning({ id: schema.dutyScheduleMonthlyPlans.id });
    if (!flipped) throw new Error("Esta proposta foi publicada por outra pessoa.");
    await audit(tx, context.userId, planId, "duty_schedule_monthly_plan.published");

    const counts = new Map<string, number>();
    for (const assignment of assignments) counts.set(assignment.brokerId, (counts.get(assignment.brokerId) ?? 0) + 1);
    const [year, month] = plan.monthKey.split("-").map(Number);
    const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
    for (const [brokerId, count] of counts) {
      await tx.insert(schema.notifications).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        recipientUserId: brokerId,
        type: "duty_schedule_published",
        title: "Sua escala de plantões foi publicada",
        message: `Você tem ${count} plantão${count === 1 ? "" : "ões"} em ${monthName}. Confira em Minha fila.`,
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
