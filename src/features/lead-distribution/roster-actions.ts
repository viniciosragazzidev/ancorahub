"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne, or, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";
import { wakeLeadsAwaitingEligibleBroker } from "./jobs";
import { getRosterBrokerAccountFilter } from "./roster-broker-account-filter";

export type RosterActionState = { success?: boolean; error?: string; message?: string };

const assignmentInput = z.object({
  scheduleId: z.string().uuid(),
  brokerId: z.string().min(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string(),
  endsAt: z.string(),
});

function parseInput(formData: FormData) {
  const parsed = assignmentInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Escala inválida.");
  if (!isValidDutyWindow(parsed.data.dayOfWeek, parsed.data.startsAt, parsed.data.endsAt)) {
    throw new Error("Informe um horário válido para a escala.");
  }
  return parsed.data;
}

async function assertRosterScope(scheduleId: string, brokerId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Gestores e Diretores podem editar a escala.");
  const db = getDatabase();
  const [schedule] = await db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, validFrom: schema.unitDutySchedules.validFrom, validUntil: schema.unitDutySchedules.validUntil, status: schema.unitDutySchedules.status, maximumBrokers: schema.unitDutySchedules.maximumBrokers })
    .from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule || schedule.status !== "active") throw new Error("O plantão selecionado não está ativo.");
  if (context.role === "manager" && schedule.branchId && context.branchId !== schedule.branchId) throw new Error("Você só pode editar a escala da sua unidade.");
  if (!schedule.branchId && context.role === "manager" && !context.branchId) throw new Error("Unidade do corretor não identificada.");
  const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, brokerId),
      schedule.branchId ? eq(schema.tenantMemberships.branchId, schedule.branchId) : undefined,
      context.role === "manager" && context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined,
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.jobTitle, "broker"),
      await getRosterBrokerAccountFilter(),
    ))
    .limit(1);
  if (!broker) throw new Error("O corretor está fora do escopo ou da política de inclusão na escala.");
  return { context, db, schedule, broker };
}

type Database = ReturnType<typeof getDatabase>;
/** The caller's transaction: checks must run on its connection, not on a second pooled one. */
type DatabaseOrTransaction = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

type Validity = { validFrom: Date; validUntil: Date | null };

/** Overlap warning returned to the caller; saving is allowed (DEC-132). */
type BrokerOverlapWarning = { name: string; startsAt: string; endsAt: string } | null;

/**
 * Same broker, same weekday, overlapping hours, in an active plantão whose
 * validity shares at least one date with `period`. The plantão's own validity
 * is the source of truth: a plantão from another week (e.g. "PME 24/09" when
 * adding to "PME 01/10") never collides.
 *
 * Since DEC-132 an overlap no longer blocks the save: the caller decides how
 * to surface it (UI warning) and must audit it when saving anyway.
 */
async function findBrokerOverlap(db: DatabaseOrTransaction, tenantId: string, brokerId: string, dayOfWeek: number, startsAt: string, endsAt: string, period: Validity, excludedId?: string): Promise<BrokerOverlapWarning> {
  const conditions = [
    eq(schema.dutyRosterAssignments.tenantId, tenantId),
    eq(schema.dutyRosterAssignments.brokerId, brokerId),
    eq(schema.dutyRosterAssignments.dayOfWeek, dayOfWeek),
    eq(schema.dutyRosterAssignments.status, "active"),
    isNull(schema.dutyRosterAssignments.dutyDate),
    lt(schema.dutyRosterAssignments.startsAt, endsAt),
    gt(schema.dutyRosterAssignments.endsAt, startsAt),
    eq(schema.unitDutySchedules.status, "active"),
    or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, period.validFrom)),
    period.validUntil ? lt(schema.unitDutySchedules.validFrom, period.validUntil) : undefined,
  ];
  if (excludedId) conditions.push(ne(schema.dutyRosterAssignments.id, excludedId));
  const [conflict] = await db.select({ name: schema.unitDutySchedules.name, startsAt: schema.dutyRosterAssignments.startsAt, endsAt: schema.dutyRosterAssignments.endsAt })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId))
    .where(and(...conditions))
    .limit(1);
  return conflict ?? null;
}

/** DEC-132: saving an overlapping scale is allowed, but always audited. */
async function auditOverlapAllowed(db: DatabaseOrTransaction, userId: string, brokerId: string) {
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "duty_roster_assignment",
    entidadeId: brokerId,
    acao: "duty_roster_assignment.overlap_allowed",
  });
}

async function assertScheduleCapacity(db: DatabaseOrTransaction, tenantId: string, scheduleId: string, dayOfWeek: number, maximumBrokers: number | null, excludedId?: string) {
  if (maximumBrokers === null) return;
  const conditions = [
    eq(schema.dutyRosterAssignments.tenantId, tenantId),
    eq(schema.dutyRosterAssignments.scheduleId, scheduleId),
    eq(schema.dutyRosterAssignments.dayOfWeek, dayOfWeek),
    eq(schema.dutyRosterAssignments.status, "active"),
    isNull(schema.dutyRosterAssignments.dutyDate),
  ];
  if (excludedId) conditions.push(ne(schema.dutyRosterAssignments.id, excludedId));
  const occupied = await db.select({ id: schema.dutyRosterAssignments.id }).from(schema.dutyRosterAssignments).where(and(...conditions));
  if (occupied.length >= maximumBrokers) throw new Error("Este plantão atingiu o máximo de corretores definido.");
}

export async function createRosterAssignmentAction(_previous: RosterActionState, formData: FormData): Promise<RosterActionState> {
  try {
    const input = parseInput(formData);
    const { context, db, schedule, broker } = await assertRosterScope(input.scheduleId, input.brokerId);
    const now = new Date();
    if (!broker.branchId) throw new Error("O corretor não está vinculado a uma unidade ativa.");
    const brokerBranchId = broker.branchId;
    const overlapWarning = await db.transaction(async (tx): Promise<BrokerOverlapWarning> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext(${`duty-capacity:${schedule.id}:${input.dayOfWeek}`}))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext(${`duty-broker:${input.brokerId}:${input.dayOfWeek}`}))`);
      const overlap = await findBrokerOverlap(tx, context.tenantId, input.brokerId, input.dayOfWeek, input.startsAt, input.endsAt, schedule);
      if (overlap) await auditOverlapAllowed(tx, context.userId, input.brokerId);
      await assertScheduleCapacity(tx, context.tenantId, schedule.id, input.dayOfWeek, schedule.maximumBrokers);
      await tx.insert(schema.dutyRosterAssignments).values({ id: randomUUID(), tenantId: context.tenantId, branchId: brokerBranchId, scheduleId: schedule.id, brokerId: input.brokerId, dayOfWeek: input.dayOfWeek, startsAt: input.startsAt, endsAt: input.endsAt, validFrom: schedule.validFrom, validUntil: schedule.validUntil, status: "active", createdBy: context.userId, updatedBy: context.userId, createdAt: now, updatedAt: now });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: input.brokerId, acao: "duty_roster_assignment.created" });
      return overlap;
    });
    await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
    return overlapWarning
      ? { success: true, message: `Corretor também está no plantão "${overlapWarning.name}" das ${overlapWarning.startsAt} às ${overlapWarning.endsAt}; ele ficará nos dois plantões neste horário.` }
      : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível adicionar o corretor à escala." };
  }
}

export async function moveRosterAssignmentAction(_previous: RosterActionState, formData: FormData): Promise<RosterActionState> {
  const assignmentId = z.string().uuid().safeParse(formData.get("assignmentId"));
  if (!assignmentId.success) return { error: "Alocação inválida." };
  try {
    const input = parseInput(formData);
    const { context, db, schedule } = await assertRosterScope(input.scheduleId, input.brokerId);
    const [assignment] = await db.select({ id: schema.dutyRosterAssignments.id, brokerId: schema.dutyRosterAssignments.brokerId, tenantId: schema.dutyRosterAssignments.tenantId })
      .from(schema.dutyRosterAssignments)
      .where(and(eq(schema.dutyRosterAssignments.id, assignmentId.data), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active"), isNull(schema.dutyRosterAssignments.dutyDate)))
      .limit(1);
    if (!assignment || assignment.brokerId !== input.brokerId) throw new Error("A alocação não pertence a este corretor.");
    const overlapWarning = await db.transaction(async (tx): Promise<BrokerOverlapWarning> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext(${`duty-capacity:${schedule.id}:${input.dayOfWeek}`}))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${context.tenantId}), hashtext(${`duty-broker:${input.brokerId}:${input.dayOfWeek}`}))`);
      const overlap = await findBrokerOverlap(tx, context.tenantId, input.brokerId, input.dayOfWeek, input.startsAt, input.endsAt, schedule, assignment.id);
      if (overlap) await auditOverlapAllowed(tx, context.userId, input.brokerId);
      await assertScheduleCapacity(tx, context.tenantId, schedule.id, input.dayOfWeek, schedule.maximumBrokers, assignment.id);
      await tx.update(schema.dutyRosterAssignments).set({ scheduleId: schedule.id, dayOfWeek: input.dayOfWeek, startsAt: input.startsAt, endsAt: input.endsAt, updatedBy: context.userId, updatedAt: new Date() }).where(and(eq(schema.dutyRosterAssignments.id, assignment.id), eq(schema.dutyRosterAssignments.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: "duty_roster_assignment.moved" });
      return overlap;
    });
    return overlapWarning
      ? { success: true, message: `Corretor também está no plantão "${overlapWarning.name}" das ${overlapWarning.startsAt} às ${overlapWarning.endsAt}; ele ficará nos dois plantões neste horário.` }
      : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível mover a escala." };
  }
}

export async function removeRosterAssignmentAction(_previous: RosterActionState, formData: FormData): Promise<RosterActionState> {
  const assignmentId = z.string().uuid().safeParse(formData.get("assignmentId"));
  if (!assignmentId.success) return { error: "Alocação inválida." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") throw new Error("Sem permissão.");
    const db = getDatabase();
    const [assignment] = await db.select({ id: schema.dutyRosterAssignments.id, branchId: schema.dutyRosterAssignments.branchId }).from(schema.dutyRosterAssignments).where(and(eq(schema.dutyRosterAssignments.id, assignmentId.data), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active"))).limit(1);
    if (!assignment || (context.role === "manager" && context.branchId !== assignment.branchId)) throw new Error("Escala fora do seu escopo.");
    await db.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: new Date() }).where(eq(schema.dutyRosterAssignments.id, assignment.id));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: "duty_roster_assignment.removed" });
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível remover a escala." };
  }
}
