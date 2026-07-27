"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";

export type RosterActionState = { success?: boolean; error?: string };

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
  const [schedule] = await db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, validFrom: schema.unitDutySchedules.validFrom, validUntil: schema.unitDutySchedules.validUntil, status: schema.unitDutySchedules.status })
    .from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule || schedule.status !== "active") throw new Error("O plantão selecionado não está ativo.");
  if (context.role === "manager" && context.branchId !== schedule.branchId) throw new Error("Você só pode editar a escala da sua unidade.");
  const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.branchId, schedule.branchId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active")))
    .limit(1);
  if (!broker) throw new Error("O corretor não pertence a uma unidade ativa elegível.");
  return { context, db, schedule };
}

async function assertNoOverlap(db: ReturnType<typeof getDatabase>, tenantId: string, brokerId: string, dayOfWeek: number, startsAt: string, endsAt: string, excludedId?: string) {
  const conditions = [
    eq(schema.dutyRosterAssignments.tenantId, tenantId),
    eq(schema.dutyRosterAssignments.brokerId, brokerId),
    eq(schema.dutyRosterAssignments.dayOfWeek, dayOfWeek),
    eq(schema.dutyRosterAssignments.status, "active"),
    lt(schema.dutyRosterAssignments.startsAt, endsAt),
    gt(schema.dutyRosterAssignments.endsAt, startsAt),
  ];
  if (excludedId) conditions.push(ne(schema.dutyRosterAssignments.id, excludedId));
  const [conflict] = await db.select({ id: schema.dutyRosterAssignments.id })
    .from(schema.dutyRosterAssignments)
    .where(and(...conditions))
    .limit(1);
  if (conflict) throw new Error("Este corretor já está escalado em um horário sobreposto.");
}

export async function createRosterAssignmentAction(_previous: RosterActionState, formData: FormData): Promise<RosterActionState> {
  try {
    const input = parseInput(formData);
    const { context, db, schedule } = await assertRosterScope(input.scheduleId, input.brokerId);
    await assertNoOverlap(db, context.tenantId, input.brokerId, input.dayOfWeek, input.startsAt, input.endsAt);
    const now = new Date();
    await db.insert(schema.dutyRosterAssignments).values({ id: randomUUID(), tenantId: context.tenantId, branchId: schedule.branchId, scheduleId: schedule.id, brokerId: input.brokerId, dayOfWeek: input.dayOfWeek, startsAt: input.startsAt, endsAt: input.endsAt, validFrom: schedule.validFrom, validUntil: schedule.validUntil, status: "active", createdBy: context.userId, updatedBy: context.userId, createdAt: now, updatedAt: now });
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: input.brokerId, acao: "duty_roster_assignment.created" });
    revalidatePath("/leads/distribuicao/plantao");
    return { success: true };
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
      .where(and(eq(schema.dutyRosterAssignments.id, assignmentId.data), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active")))
      .limit(1);
    if (!assignment || assignment.brokerId !== input.brokerId) throw new Error("A alocação não pertence a este corretor.");
    await assertNoOverlap(db, context.tenantId, input.brokerId, input.dayOfWeek, input.startsAt, input.endsAt, assignment.id);
    await db.update(schema.dutyRosterAssignments).set({ scheduleId: schedule.id, branchId: schedule.branchId, dayOfWeek: input.dayOfWeek, startsAt: input.startsAt, endsAt: input.endsAt, updatedBy: context.userId, updatedAt: new Date() }).where(eq(schema.dutyRosterAssignments.id, assignment.id));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_roster_assignment", entidadeId: assignment.id, acao: "duty_roster_assignment.moved" });
    revalidatePath("/leads/distribuicao/plantao");
    return { success: true };
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
    revalidatePath("/leads/distribuicao/plantao");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível remover a escala." };
  }
}
