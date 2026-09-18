"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";
import { dutyScheduleInput, parseCreateDutyScheduleInput, parseDutyScheduleInput } from "./duty-schedule-input";

export type DutyActionState = { success?: boolean; error?: string; message?: string; scheduleId?: string; scheduleIds?: string[] };


async function assertBatchDutyAccess() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Apenas Diretores podem configurar plantões globais.");
  return { context, db: getDatabase() };
}

type ScheduleConflictInput = Pick<z.infer<typeof dutyScheduleInput>, "branchId" | "queueId" | "dayOfWeek" | "startsAt" | "endsAt">;

async function assertNoScheduleConflict(
  db: ReturnType<typeof getDatabase>,
  input: ScheduleConflictInput,
  tenantId: string,
  excludedScheduleId?: string,
) {
  const conditions = [
    eq(schema.unitDutySchedules.tenantId, tenantId),
    eq(schema.unitDutySchedules.dayOfWeek, input.dayOfWeek),
    eq(schema.unitDutySchedules.status, "active"),
    lt(schema.unitDutySchedules.startsAt, input.endsAt),
    gt(schema.unitDutySchedules.endsAt, input.startsAt),
    input.branchId === null || input.branchId === undefined
      ? and(isNull(schema.unitDutySchedules.branchId), isNull(schema.unitDutySchedules.queueId))
      : and(eq(schema.unitDutySchedules.branchId, input.branchId), input.queueId ? eq(schema.unitDutySchedules.queueId, input.queueId) : isNull(schema.unitDutySchedules.queueId)),
  ];
  if (excludedScheduleId) conditions.push(ne(schema.unitDutySchedules.id, excludedScheduleId));

  const [conflict] = await db
    .select({ id: schema.unitDutySchedules.id })
    .from(schema.unitDutySchedules)
    .where(and(...conditions))
    .limit(1);
  if (conflict) {
    throw new Error("Já existe um plantão ativo com o mesmo horário neste escopo.");
  }
}

function validateSchedule(input: Pick<z.infer<typeof dutyScheduleInput>, "dayOfWeek" | "startsAt" | "endsAt" | "validFrom" | "validUntil">) {
  if (!isValidDutyWindow(input.dayOfWeek, input.startsAt, input.endsAt)) {
    throw new Error("Informe um horário válido. O fim deve ser depois do início.");
  }
  if (input.validUntil && input.validUntil < input.validFrom) {
    throw new Error("O fim da vigência não pode ser anterior ao início.");
  }
}

async function findScheduleForMutation(scheduleId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [schedule] = await db
    .select({
      id: schema.unitDutySchedules.id,
      tenantId: schema.unitDutySchedules.tenantId,
      branchId: schema.unitDutySchedules.branchId,
      queueId: schema.unitDutySchedules.queueId,
      name: schema.unitDutySchedules.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      webhookCredentialId: schema.unitDutySchedules.webhookCredentialId,
      status: schema.unitDutySchedules.status,
    })
    .from(schema.unitDutySchedules)
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule) throw new Error("Plantão não encontrado.");
  if (context.role !== "director" && context.role !== "manager") throw new Error("Sem permissão.");
  if (context.role === "manager" && schedule.branchId && context.branchId !== schedule.branchId) {
    throw new Error("Plantão fora do seu escopo.");
  }
  return { context, db, schedule };
}

function revalidateDutyWorkspace() {
}

export async function createDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const parsed = parseCreateDutyScheduleInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados do plantão." };
  try {
    for (const dayOfWeek of parsed.data.daysOfWeek) {
      validateSchedule({ ...parsed.data, dayOfWeek });
    }
    const { context, db } = await assertBatchDutyAccess();
    const schedules = parsed.data.daysOfWeek.map((dayOfWeek) => ({
        branchId: null,
        queueId: null,
        name: parsed.data.name,
        dayOfWeek,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        minimumBrokers: parsed.data.minimumBrokers,
        validFrom: parsed.data.validFrom,
        validUntil: parsed.data.validUntil,
        webhookCredentialId: parsed.data.webhookCredentialId,
      }));
    for (const schedule of schedules) {
      await assertNoScheduleConflict(db, schedule, context.tenantId);
    }
    const scheduleIds = schedules.map(() => randomUUID());
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.unitDutySchedules).values(schedules.map((schedule, index) => ({
        id: scheduleIds[index],
        tenantId: context.tenantId,
        branchId: schedule.branchId,
        queueId: schedule.queueId,
        name: schedule.name,
        dayOfWeek: schedule.dayOfWeek,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        priority: 100,
        minimumBrokers: schedule.minimumBrokers,
        validFrom: schedule.validFrom,
        validUntil: schedule.validUntil ?? null,
        webhookCredentialId: schedule.webhookCredentialId ?? null,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      })));
      await tx.insert(schema.auditLogs).values(scheduleIds.map((scheduleId) => ({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: scheduleId, acao: "duty_schedule.created",
      })));
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: scheduleIds[0], scheduleIds, message: `${scheduleIds.length} plantão(ões) criado(s) para todas as unidades.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o plantão." };
  }
}

export async function updateDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  const parsed = parseDutyScheduleInput(formData);
  if (!scheduleId.success || !parsed.success) return { error: "Revise os dados do plantão." };
  try {
    validateSchedule(parsed.data);
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Restaure o plantão antes de editá-lo.");
    if (context.role === "manager") throw new Error("Apenas Diretores podem editar plantões globais.");
    await assertNoScheduleConflict(db, parsed.data, context.tenantId, schedule.id);
    await db.transaction(async (tx) => {
      await tx.update(schema.unitDutySchedules).set({
        ...parsed.data,
        validUntil: parsed.data.validUntil ?? null,
        webhookCredentialId: parsed.data.webhookCredentialId ?? null,
        updatedAt: new Date(),
      }).where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.updated",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id, message: "Plantão atualizado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível editar o plantão." };
  }
}

export async function toggleDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Restaure o plantão antes de ativá-lo.");
    const next = schedule.status === "active" ? "inactive" : "active";
    if (next === "active") {
      await assertNoScheduleConflict(db, schedule, context.tenantId, schedule.id);
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.unitDutySchedules).set({ status: next, updatedAt: new Date() })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id,
        acao: next === "active" ? "duty_schedule.activated" : "duty_schedule.deactivated",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar o plantão." };
  }
}

export async function duplicateDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Não é possível duplicar um plantão arquivado.");
    const cloneId = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.unitDutySchedules).values({
        ...schedule,
        id: cloneId,
        name: `${schedule.name} (cópia)`,
        status: "inactive",
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: cloneId, acao: "duty_schedule.duplicated",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: cloneId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível duplicar o plantão." };
  }
}

export async function archiveDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") return { success: true, scheduleId: schedule.id };
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx.update(schema.unitDutySchedules).set({ status: "archived", updatedAt: now })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.update(schema.dutyRosterAssignments).set({ status: "inactive", updatedBy: context.userId, updatedAt: now })
        .where(and(eq(schema.dutyRosterAssignments.scheduleId, schedule.id), eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active")));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.archived",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível arquivar o plantão." };
  }
}

export async function deleteDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    await db.transaction(async (tx) => {
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "unit_duty_schedule",
        entidadeId: schedule.id,
        acao: "duty_schedule.deleted",
      });
      await tx.delete(schema.dutyRosterAssignments).where(and(
        eq(schema.dutyRosterAssignments.scheduleId, schedule.id),
        eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
      ));
      await tx.delete(schema.unitDutySchedules).where(and(
        eq(schema.unitDutySchedules.id, schedule.id),
        eq(schema.unitDutySchedules.tenantId, context.tenantId),
      ));
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id, message: "Plantão excluído permanentemente." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o plantão." };
  }
}

export async function restoreDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try {
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status !== "archived") throw new Error("Este plantão não está arquivado.");
    await assertNoScheduleConflict(db, schedule, context.tenantId, schedule.id);
    await db.transaction(async (tx) => {
      await tx.update(schema.unitDutySchedules).set({ status: "inactive", updatedAt: new Date() })
        .where(and(eq(schema.unitDutySchedules.id, schedule.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: "duty_schedule.restored",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId: schedule.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível restaurar o plantão." };
  }
}
