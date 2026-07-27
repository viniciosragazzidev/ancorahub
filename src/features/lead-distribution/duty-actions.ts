"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isValidDutyWindow } from "./domain";

export type DutyActionState = { success?: boolean; error?: string };
const input = z.object({ branchId: z.string().uuid(), queueId: z.string().uuid(), name: z.string().trim().min(2).max(100), dayOfWeek: z.coerce.number().int().min(0).max(6), startsAt: z.string(), endsAt: z.string(), priority: z.coerce.number().int().min(1).max(999), validFrom: z.coerce.date(), validUntil: z.coerce.date().optional(), webhookCredentialId: z.string().uuid().optional().nullable() });

async function assertDutyAccess(branchId: string) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new Error("Apenas Gestores e Diretores podem configurar plantões.");
  if (context.role === "manager" && context.branchId !== branchId) throw new Error("Você só pode configurar plantões da sua unidade.");
  return { context, db: getDatabase() };
}

export async function createDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const raw = Object.fromEntries(formData);
  // Zod treats empty strings as missing for uuid/date coercion — strip them
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim() === "") continue;
    cleaned[key] = value;
  }
  const parsed = input.safeParse(cleaned);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise os dados do plantão." };
  if (!isValidDutyWindow(parsed.data.dayOfWeek, parsed.data.startsAt, parsed.data.endsAt)) return { error: "Informe um horário válido. O fim deve ser depois do início." };
  if (parsed.data.validUntil && parsed.data.validUntil < parsed.data.validFrom) return { error: "O fim da vigência não pode ser anterior ao início." };
  try { const { context, db } = await assertDutyAccess(parsed.data.branchId); const [queue] = await db.select({ id: schema.leadQueues.id }).from(schema.leadQueues).where(and(eq(schema.leadQueues.id, parsed.data.queueId), eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.branchId, parsed.data.branchId), eq(schema.leadQueues.status, "active"))).limit(1); if (!queue) return { error: "Fila não encontrada nesta unidade." }; const [conflict] = await db.select({ id: schema.unitDutySchedules.id }).from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), eq(schema.unitDutySchedules.branchId, parsed.data.branchId), eq(schema.unitDutySchedules.dayOfWeek, parsed.data.dayOfWeek), eq(schema.unitDutySchedules.priority, parsed.data.priority), eq(schema.unitDutySchedules.status, "active"))).limit(1); if (conflict) return { error: "Já existe um plantão ativo com a mesma prioridade neste dia." }; await db.transaction(async (tx) => { await tx.insert(schema.unitDutySchedules).values({ id: randomUUID(), tenantId: context.tenantId, branchId: parsed.data.branchId, queueId: parsed.data.queueId, name: parsed.data.name, dayOfWeek: parsed.data.dayOfWeek, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt, priority: parsed.data.priority, validFrom: parsed.data.validFrom, validUntil: parsed.data.validUntil ?? null, webhookCredentialId: parsed.data.webhookCredentialId ?? null, createdBy: context.userId, createdAt: new Date(), updatedAt: new Date() }); await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: parsed.data.branchId, acao: "duty_schedule.created" }); }); revalidatePath("/leads/distribuicao/plantao"); return { success: true }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível criar o plantão." }; }
}

export async function toggleDutyScheduleAction(_previous: DutyActionState, formData: FormData): Promise<DutyActionState> {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) return { error: "Plantão inválido." };
  try { const context = await getRequiredTenantContext(); if (context.role !== "director" && context.role !== "manager") throw new Error("Sem permissão."); const db = getDatabase(); const [schedule] = await db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, status: schema.unitDutySchedules.status }).from(schema.unitDutySchedules).where(and(eq(schema.unitDutySchedules.id, scheduleId.data), eq(schema.unitDutySchedules.tenantId, context.tenantId))).limit(1); if (!schedule || (context.role === "manager" && context.branchId !== schedule.branchId)) throw new Error("Plantão fora do seu escopo."); const next = schedule.status === "active" ? "inactive" : "active"; await db.transaction(async (tx) => { await tx.update(schema.unitDutySchedules).set({ status: next, updatedAt: new Date() }).where(eq(schema.unitDutySchedules.id, schedule.id)); await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "unit_duty_schedule", entidadeId: schedule.id, acao: next === "active" ? "duty_schedule.activated" : "duty_schedule.deactivated" }); }); revalidatePath("/leads/distribuicao/plantao"); return { success: true }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível atualizar o plantão." }; }
}
