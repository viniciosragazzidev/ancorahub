"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";

export type DutyActionState = { success?: boolean; error?: string; scheduleId?: string };

const scheduleInput = z.object({
  branchId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string(),
  endsAt: z.string(),
  priority: z.coerce.number().int().min(1).max(999),
  minimumBrokers: z.coerce.number().int().min(1).max(99),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  webhookCredentialId: z.string().uuid().optional().nullable(),
});

function cleanFormData(formData: FormData) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() === "") continue;
    cleaned[key] = value;
  }
  return cleaned;
}

async function assertDutyAccess(branchId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new Error("Apenas Gestores e Diretores podem configurar plantões.");
  }
  if (context.role === "manager" && context.branchId !== branchId) {
    throw new Error("Você só pode configurar plantões da sua unidade.");
  }
  return { context, db: getDatabase() };
}

async function assertQueueInScope(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  branchId: string,
  queueId: string,
) {
  const [queue] = await db
    .select({ id: schema.leadQueues.id })
    .from(schema.leadQueues)
    .where(and(
      eq(schema.leadQueues.id, queueId),
      eq(schema.leadQueues.tenantId, tenantId),
      eq(schema.leadQueues.branchId, branchId),
      eq(schema.leadQueues.status, "active"),
    ))
    .limit(1);
  if (!queue) throw new Error("Fila não encontrada nesta unidade.");
}

type ScheduleConflictInput = Pick<z.infer<typeof scheduleInput>, "branchId" | "queueId" | "dayOfWeek" | "priority" | "startsAt" | "endsAt">;

async function assertNoScheduleConflict(
  db: ReturnType<typeof getDatabase>,
  input: ScheduleConflictInput,
  tenantId: string,
  excludedScheduleId?: string,
) {
  const conditions = [
    eq(schema.unitDutySchedules.tenantId, tenantId),
    eq(schema.unitDutySchedules.branchId, input.branchId),
    eq(schema.unitDutySchedules.queueId, input.queueId),
    eq(schema.unitDutySchedules.dayOfWeek, input.dayOfWeek),
    eq(schema.unitDutySchedules.priority, input.priority),
    eq(schema.unitDutySchedules.status, "active"),
    lt(schema.unitDutySchedules.startsAt, input.endsAt),
    gt(schema.unitDutySchedules.endsAt, input.startsAt),
  ];
  if (excludedScheduleId) conditions.push(ne(schema.unitDutySchedules.id, excludedScheduleId));

  const [conflict] = await db
    .select({ id: schema.unitDutySchedules.id })
    .from(schema.unitDutySchedules)
    .where(and(...conditions))
    .limit(1);
  if (conflict) {
    throw new Error("Já existe um plantão ativo com a mesma prioridade e horário nesta fila.");
  }
}

function validateSchedule(input: z.infer<typeof scheduleInput>) {
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
  if (context.role === "manager" && context.branchId !== schedule.branchId) {
    throw new Error("Plantão fora do seu escopo.");
  }
  return { context, db, schedule };
}

function revalidateDutyWorkspace() {
  revalidatePath("/leads/distribuicao/plantao");
}

export async function createDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const parsed = scheduleInput.safeParse(cleanFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados do plantão." };
  try {
    validateSchedule(parsed.data);
    const { context, db } = await assertDutyAccess(parsed.data.branchId);
    await assertQueueInScope(db, context.tenantId, parsed.data.branchId, parsed.data.queueId);
    await assertNoScheduleConflict(db, parsed.data, context.tenantId);
    const scheduleId = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.unitDutySchedules).values({
        id: scheduleId,
        tenantId: context.tenantId,
        ...parsed.data,
        validUntil: parsed.data.validUntil ?? null,
        webhookCredentialId: parsed.data.webhookCredentialId ?? null,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: scheduleId, acao: "duty_schedule.created",
      });
    });
    revalidateDutyWorkspace();
    return { success: true, scheduleId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o plantão." };
  }
}

export async function updateDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  const parsed = scheduleInput.safeParse(cleanFormData(formData));
  if (!scheduleId.success || !parsed.success) return { error: "Revise os dados do plantão." };
  try {
    validateSchedule(parsed.data);
    const { context, db, schedule } = await findScheduleForMutation(scheduleId.data);
    if (schedule.status === "archived") throw new Error("Restaure o plantão antes de editá-lo.");
    await assertQueueInScope(db, context.tenantId, parsed.data.branchId, parsed.data.queueId);
    if (parsed.data.branchId !== schedule.branchId && context.role === "manager") {
      throw new Error("Você não pode mover o plantão para outra unidade.");
    }
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
    return { success: true, scheduleId: schedule.id };
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
