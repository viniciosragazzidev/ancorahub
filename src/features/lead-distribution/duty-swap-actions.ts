"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, gte, inArray, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { enqueueMetaTextMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSaoPauloDateKey } from "./dated-duty-roster";
import {
  buildDutySwapWhatsAppMessage,
  canManageSwaps,
  dutySwapProblem,
  effectiveSwapDate,
  NOT_SWAPPABLE_WEEKLY,
  rowCoversDate,
  selectSwapCandidates,
  slotStarted,
  swapPlanAssignments,
  type SwapBroker,
  type SwapCandidate,
  type SwapCandidateRow,
  type SwapSlot,
  type WhatsAppSwapStatus,
} from "./duty-swap";
import { dayOfWeekOf } from "./monthly-duty-plan";
import { getRosterBrokerAccountFilter } from "./roster-broker-account-filter";

type Database = ReturnType<typeof getDatabase>;
type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

const SWAP_CANDIDATE_LIMIT = 1500;
const SWAP_WEEKLY_LIMIT = 4000;

function slotColumns() {
  return {
    id: schema.dutyRosterAssignments.id,
    status: schema.dutyRosterAssignments.status,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    scheduleName: schema.unitDutySchedules.name,
    scheduleStatus: schema.unitDutySchedules.status,
    scheduleBranchId: schema.unitDutySchedules.branchId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    scheduleValidFrom: schema.unitDutySchedules.validFrom,
    scheduleValidUntil: schema.unitDutySchedules.validUntil,
    monthlyPlanId: schema.dutyRosterAssignments.monthlyPlanId,
  };
}

type SlotColumnsRow = {
  dutyDate: string | null;
  dayOfWeek: number;
  startsAt: string;
  timezone: string | null;
  scheduleValidFrom: Date;
  scheduleValidUntil: Date | null;
};

/**
 * Row as the swap sees it: `rowDutyDate` is the column (null on weekly rows) and `dutyDate`
 * the date the swap works with (published date, or the single date of a one-time weekly row).
 */
function toSwapSlot<T extends SlotColumnsRow>(row: T) {
  const timezone = row.timezone ?? "America/Sao_Paulo";
  const weekly = row.dutyDate ? null : { dayOfWeek: row.dayOfWeek, validFrom: row.scheduleValidFrom, validUntil: row.scheduleValidUntil };
  return { ...row, timezone, weekly, rowDutyDate: row.dutyDate, dutyDate: effectiveSwapDate({ dutyDate: row.dutyDate, startsAt: row.startsAt, timezone, weekly }) };
}

async function loadSlots(db: Executor, tenantId: string, ids: string[]) {
  const rows = await db.select(slotColumns())
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
    .where(and(eq(schema.dutyRosterAssignments.tenantId, tenantId), inArray(schema.dutyRosterAssignments.id, ids)));
  return rows.map(toSwapSlot);
}

/** Name, unit and whether each broker is still a planning broker (active broker, active unit). */
async function loadSwapBrokers(db: Executor, tenantId: string, brokerIds: string[]): Promise<Map<string, SwapBroker>> {
  const [people, eligible] = await Promise.all([
    db.select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
      .from(schema.user)
      .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, tenantId)))
      .where(inArray(schema.user.id, brokerIds)),
    db.select({ id: schema.user.id })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .innerJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, schema.tenantMemberships.tenantId)))
      .where(and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        inArray(schema.tenantMemberships.userId, brokerIds),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.jobTitle, "broker"),
        await getRosterBrokerAccountFilter(),
        eq(schema.branches.status, "active"),
      )),
  ]);
  const eligibleIds = new Set(eligible.map((row) => row.id));
  return new Map(people.map((row) => [row.id, { id: row.id, name: row.name, branchId: row.branchId ?? null, eligible: eligibleIds.has(row.id) }]));
}

/** The broker is already on this plantão and day: another active published row, or a weekly row in force on the date. */
async function brokerAlreadyOn(db: Executor, tenantId: string, brokerId: string, slot: SwapSlot, excludedIds: string[]) {
  const dutyDate = slot.dutyDate!;
  const rows = await db.select({ ...slotColumns() })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      eq(schema.dutyRosterAssignments.scheduleId, slot.scheduleId),
      eq(schema.dutyRosterAssignments.brokerId, brokerId),
      eq(schema.dutyRosterAssignments.status, "active"),
      notInArray(schema.dutyRosterAssignments.id, excludedIds),
      or(
        eq(schema.dutyRosterAssignments.dutyDate, dutyDate),
        and(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dayOfWeek, dayOfWeekOf(dutyDate))),
      ),
    ));
  return rows.map(toSwapSlot).some((row) => rowCoversDate(row, slot.scheduleId, dutyDate));
}

export type DutySwapSourceView = { brokerName: string; scheduleName: string; dutyDate: string; startsAt: string; endsAt: string };

/** Future slots (published, or one-time weekly) the broker of `assignmentId` can swap with (picker of "Efetuar troca"). */
export async function listDutySwapCandidatesAction(assignmentId: string): Promise<
  { ok: true; source: DutySwapSourceView; candidates: SwapCandidate[] } | { ok: false; reason: string }
> {
  try {
    const id = z.string().min(1).max(120).parse(assignmentId);
    const context = await getRequiredTenantContext();
    if (!canManageSwaps(context.role)) return { ok: false, reason: "Apenas Diretores e Gestores podem trocar corretores da escala." };
    const actor = { role: context.role, branchId: context.branchId ?? null };
    const db = getDatabase();
    const now = new Date();
    const [source] = await loadSlots(db, context.tenantId, [id]);
    if (!source || source.status !== "active") return { ok: false, reason: "Esta escalação não existe mais. Atualize a página." };
    if (!source.dutyDate) return { ok: false, reason: NOT_SWAPPABLE_WEEKLY };
    if (slotStarted(source, now)) return { ok: false, reason: "Este plantão já começou. Só dá para trocar plantões que ainda não começaram." };

    const candidateColumns = { ...slotColumns(), brokerName: schema.user.name, brokerBranchId: schema.tenantMemberships.branchId, brokerCode: schema.brokerProfiles.internalCode };
    const candidateQuery = () => db.select(candidateColumns)
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
      .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
      .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.dutyRosterAssignments.brokerId), eq(schema.tenantMemberships.tenantId, context.tenantId)))
      .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.dutyRosterAssignments.brokerId), eq(schema.brokerProfiles.tenantId, context.tenantId)));
    const [datedRows, weeklyRows] = await Promise.all([
      candidateQuery()
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.status, "active"),
          isNotNull(schema.dutyRosterAssignments.dutyDate),
          gte(schema.dutyRosterAssignments.dutyDate, getSaoPauloDateKey(now)),
          eq(schema.unitDutySchedules.status, "active"),
        ))
        .orderBy(schema.dutyRosterAssignments.dutyDate, schema.dutyRosterAssignments.startsAt)
        .limit(SWAP_CANDIDATE_LIMIT),
      // Weekly rows of plantões still in force: the one-time ones are candidates, all of them count as "already on".
      candidateQuery()
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.status, "active"),
          isNull(schema.dutyRosterAssignments.dutyDate),
          eq(schema.unitDutySchedules.status, "active"),
          or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now)),
        ))
        .limit(SWAP_WEEKLY_LIMIT),
    ]);
    const all: SwapCandidateRow[] = [...datedRows, ...weeklyRows].map((row) => ({ ...toSwapSlot(row), brokerBranchId: row.brokerBranchId ?? null, brokerCode: row.brokerCode ?? null }));
    const sourceRow = all.find((row) => row.id === source.id);
    if (!sourceRow) return { ok: false, reason: "Esta escalação não existe mais. Atualize a página." };
    // Only brokers still on the escala (active account and unit) are offered.
    const brokers = await loadSwapBrokers(db, context.tenantId, [...new Set(all.map((row) => row.brokerId))]);
    const candidates = selectSwapCandidates(sourceRow, all, actor, now).filter((candidate) => brokers.get(candidate.brokerId)?.eligible);
    return {
      ok: true,
      source: { brokerName: sourceRow.brokerName, scheduleName: sourceRow.scheduleName, dutyDate: source.dutyDate, startsAt: source.startsAt, endsAt: source.endsAt },
      candidates,
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível carregar os plantões para a troca." };
  }
}

export type DutySwapResult =
  | { ok: true; swapId: string; source: { brokerName: string; whatsapp: WhatsAppSwapStatus }; target: { brokerName: string; whatsapp: WhatsAppSwapStatus } }
  | { ok: false; reason: string };

const swapInput = z.object({ sourceAssignmentId: z.string().min(1).max(120), targetAssignmentId: z.string().min(1).max(120) }).strict();

/**
 * Swaps the brokers of two slots (published, or one-time weekly rows) in one transaction: the broker of the source goes to
 * the target and the other way round. Each slot keeps its plantão, date, time and mode; the
 * row's unit follows the broker now on it. Then both brokers get a WhatsApp (never fails the swap).
 */
export async function swapDutyAssignmentsAction(input: unknown): Promise<DutySwapResult> {
  try {
    const parsed = swapInput.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "Dados inválidos para a troca." };
    const { sourceAssignmentId, targetAssignmentId } = parsed.data;
    const context = await getRequiredTenantContext();
    if (!canManageSwaps(context.role)) return { ok: false, reason: "Apenas Diretores e Gestores podem trocar corretores da escala." };
    const actor = { role: context.role, branchId: context.branchId ?? null };
    const db = getDatabase();

    const done = await db.transaction(async (tx) => {
      // Same lock as every escala write (generate, edit, publish): no publication runs in the middle.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext('duty-plan'))`);
      const now = new Date();
      // Lock both rows: a parallel swap or removal of one of them waits for this one.
      await tx.select({ id: schema.dutyRosterAssignments.id }).from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), inArray(schema.dutyRosterAssignments.id, [sourceAssignmentId, targetAssignmentId])))
        .for("update");
      const slots = sourceAssignmentId === targetAssignmentId ? [] : await loadSlots(tx, context.tenantId, [sourceAssignmentId, targetAssignmentId]);
      const source = slots.find((slot) => slot.id === sourceAssignmentId) ?? null;
      const target = slots.find((slot) => slot.id === targetAssignmentId) ?? null;
      if (sourceAssignmentId === targetAssignmentId) throw new Error("Escolha outra escalação para a troca.");
      const brokers = source && target ? await loadSwapBrokers(tx, context.tenantId, [source.brokerId, target.brokerId]) : new Map<string, SwapBroker>();
      const sourceBroker = source ? brokers.get(source.brokerId) ?? null : null;
      const targetBroker = target ? brokers.get(target.brokerId) ?? null : null;
      const datedPair = Boolean(source?.dutyDate && target?.dutyDate);
      const [sourceBrokerAlreadyOnTarget, targetBrokerAlreadyOnSource] = datedPair && source && target
        ? await Promise.all([
          brokerAlreadyOn(tx, context.tenantId, source.brokerId, target, [source.id, target.id]),
          brokerAlreadyOn(tx, context.tenantId, target.brokerId, source, [source.id, target.id]),
        ])
        : [false, false];
      const problem = dutySwapProblem({ actor, source, target, sourceBroker, targetBroker, sourceBrokerAlreadyOnTarget, targetBrokerAlreadyOnSource, now });
      if (problem) throw new Error(problem);
      const a = source!;
      const b = target!;
      const brokerA = sourceBroker!;
      const brokerB = targetBroker!;

      // Each slot keeps its plantão, date, time and attendance mode; the broker (and his unit) changes.
      // A one-time weekly row stays weekly (duty_date NULL): its plantão happens on that single date.
      // A pause belonged to the broker who was there: the newcomer starts unpaused.
      for (const [slot, broker] of [[a, brokerB], [b, brokerA]] as const) {
        await tx.update(schema.dutyRosterAssignments).set({
          brokerId: broker.id,
          branchId: broker.branchId!,
          pausedAt: null,
          pausedBy: null,
          updatedBy: context.userId,
          updatedAt: now,
        }).where(and(eq(schema.dutyRosterAssignments.id, slot.id), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.brokerId, slot.brokerId)));
      }
      // Presence of the occurrence was the previous broker's (invite, early confirmation): it starts over.
      await tx.delete(schema.dutyPresenceConfirmations).where(and(
        eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
        or(
          and(eq(schema.dutyPresenceConfirmations.assignmentId, a.id), eq(schema.dutyPresenceConfirmations.dutyDate, a.dutyDate!)),
          and(eq(schema.dutyPresenceConfirmations.assignmentId, b.id), eq(schema.dutyPresenceConfirmations.dutyDate, b.dutyDate!)),
        ),
      ));

      // The escala (published plan and a newer draft) lists the same people as the published rows.
      // A one-time weekly row is not in the escala: only the dated side moves there.
      const moves = [
        ...(a.rowDutyDate ? [{ occurrenceId: `${a.scheduleId}:${a.dutyDate}`, fromBrokerId: brokerA.id, toBrokerId: brokerB.id }] : []),
        ...(b.rowDutyDate ? [{ occurrenceId: `${b.scheduleId}:${b.dutyDate}`, fromBrokerId: brokerB.id, toBrokerId: brokerA.id }] : []),
      ];
      const monthKeys = [...new Set([a.rowDutyDate, b.rowDutyDate].filter((dutyDate): dutyDate is string => Boolean(dutyDate)).flatMap((dutyDate) => {
        const [year, month] = dutyDate.split("-").map(Number);
        return [dutyDate.slice(0, 7), new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)];
      }))];
      const plans = monthKeys.length
        ? await tx.select({ id: schema.dutyScheduleMonthlyPlans.id, assignments: schema.dutyScheduleMonthlyPlans.assignments, occurrences: schema.dutyScheduleMonthlyPlans.occurrences })
          .from(schema.dutyScheduleMonthlyPlans)
          .where(and(
            eq(schema.dutyScheduleMonthlyPlans.tenantId, context.tenantId),
            inArray(schema.dutyScheduleMonthlyPlans.monthKey, monthKeys),
            inArray(schema.dutyScheduleMonthlyPlans.status, ["published", "draft"]),
          ))
        : [];
      for (const plan of plans) {
        const swapped = swapPlanAssignments(plan, moves);
        if (!swapped.changed) continue;
        await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: swapped.assignments, occurrences: swapped.occurrences, updatedAt: now })
          .where(eq(schema.dutyScheduleMonthlyPlans.id, plan.id));
      }

      const swapId = randomUUID();
      await tx.insert(schema.dutyRosterSwaps).values({
        id: swapId,
        tenantId: context.tenantId,
        assignmentAId: a.id,
        assignmentBId: b.id,
        brokerAId: brokerA.id,
        brokerBId: brokerB.id,
        scheduleAId: a.scheduleId,
        scheduleBId: b.scheduleId,
        dutyDateA: a.dutyDate!,
        dutyDateB: b.dutyDate!,
        swappedBy: context.userId,
        swappedAt: now,
      });
      await tx.insert(schema.auditLogs).values([a, b].map((slot) => ({
        id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: slot.id, acao: `duty_roster.swapped:${swapId}`, createdAt: now,
      })));
      return { swapId, a, b, brokerA, brokerB };
    });

    // WhatsApp to both brokers: each one gets his new date. A failure never undoes the swap.
    const tenantName = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1)
      .then((rows) => rows[0]?.name ?? null).catch(() => null);
    const [whatsappA, whatsappB] = await Promise.all([
      sendDutySwapWhatsApp({ tenantId: context.tenantId, requestedBy: context.userId, swapId: done.swapId, brokerId: done.brokerA.id, brokerName: done.brokerA.name, partnerName: done.brokerB.name, tenantName, newSlot: done.b, previousSlot: done.a }),
      sendDutySwapWhatsApp({ tenantId: context.tenantId, requestedBy: context.userId, swapId: done.swapId, brokerId: done.brokerB.id, brokerName: done.brokerB.name, partnerName: done.brokerA.name, tenantName, newSlot: done.a, previousSlot: done.b }),
    ]);
    await db.update(schema.dutyRosterSwaps).set({ whatsappAStatus: whatsappA, whatsappBStatus: whatsappB })
      .where(and(eq(schema.dutyRosterSwaps.id, done.swapId), eq(schema.dutyRosterSwaps.tenantId, context.tenantId))).catch(() => undefined);

    revalidatePath("/leads/distribuicao", "layout");
    revalidatePath("/distribuicao");
    revalidatePath("/minha-fila");
    revalidatePath("/plantoes");
    return { ok: true, swapId: done.swapId, source: { brokerName: done.brokerA.name, whatsapp: whatsappA }, target: { brokerName: done.brokerB.name, whatsapp: whatsappB } };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível fazer a troca." };
  }
}

async function sendDutySwapWhatsApp(input: {
  tenantId: string;
  requestedBy: string;
  swapId: string;
  brokerId: string;
  brokerName: string;
  partnerName: string;
  tenantName: string | null;
  newSlot: Pick<SwapSlot, "scheduleName" | "dutyDate" | "startsAt" | "endsAt">;
  previousSlot: Pick<SwapSlot, "scheduleName" | "dutyDate">;
}): Promise<WhatsAppSwapStatus> {
  // Same free-text path as the password link (team/password-recovery): never stops the swap.
  try {
    const db = getDatabase();
    const [profile] = await db.select({ phone: schema.brokerProfiles.phone }).from(schema.brokerProfiles)
      .where(and(eq(schema.brokerProfiles.userId, input.brokerId), eq(schema.brokerProfiles.tenantId, input.tenantId), ne(schema.brokerProfiles.phone, "")))
      .limit(1);
    if (!profile?.phone) return "no_phone";
    const queued = await enqueueMetaTextMessage({
      tenantId: input.tenantId,
      recipientType: "user",
      recipientId: input.brokerId,
      destinationPhone: profile.phone,
      purpose: "dutySwap",
      body: buildDutySwapWhatsAppMessage({
        brokerName: input.brokerName,
        partnerName: input.partnerName,
        tenantName: input.tenantName,
        newSlot: { scheduleName: input.newSlot.scheduleName, dutyDate: input.newSlot.dutyDate!, startsAt: input.newSlot.startsAt, endsAt: input.newSlot.endsAt },
        previousSlot: { scheduleName: input.previousSlot.scheduleName, dutyDate: input.previousSlot.dutyDate! },
      }),
      requestedBy: input.requestedBy,
      idempotencyKey: `duty-swap:${input.swapId}:${input.brokerId}`,
    });
    const delivery = await processMetaOutboundBatch(1, input.tenantId, queued.id);
    return delivery.sent ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
