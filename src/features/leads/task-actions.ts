"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type LeadTaskState = { success?: boolean; error?: string };

const taskInput = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().min(3, "Informe um título com ao menos 3 caracteres.").max(160),
  description: z.string().trim().max(1000).optional(),
  dueAt: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Prazo inválido.").optional(),
  priority: z.enum(["low", "normal", "urgent"]).default("normal"),
  assigneeIds: z.array(z.string().min(1)).max(12).default([]),
});

async function authorizeLeadTask(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  if (context.role === "broker" && lead.corretorId !== context.userId) throw new Error("Você só pode gerenciar tarefas dos seus leads.");
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) throw new Error("Este lead não pertence à sua filial.");
  return { context, db, lead };
}

export async function createLeadTaskAction(_previous: LeadTaskState, formData: FormData): Promise<LeadTaskState> {
  const parsed = taskInput.safeParse({
    leadId: formData.get("leadId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    priority: formData.get("priority"),
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const { context, db, lead } = await authorizeLeadTask(parsed.data.leadId);
    const assigneeIds = [...new Set(parsed.data.assigneeIds.length ? parsed.data.assigneeIds : [lead.corretorId ?? context.userId])];
    if (parsed.data.priority !== "urgent" && assigneeIds.length > 1) return { error: "Apenas tarefas urgentes podem ter mais de um responsável." };
    if (context.role === "broker" && (assigneeIds.length !== 1 || assigneeIds[0] !== context.userId)) return { error: "Você só pode atribuir tarefas a si mesmo." };
    const eligibleAssignees = await db.select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.userId, assigneeIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), ...(lead.branchId ? [eq(schema.tenantMemberships.branchId, lead.branchId)] : [])));
    if (eligibleAssignees.length !== assigneeIds.length) return { error: "Um ou mais responsáveis não estão ativos nesta filial." };
    const taskId = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadTasks).values({
        id: taskId,
        tenantId: context.tenantId,
        leadId: lead.id,
        assignedTo: lead.corretorId ?? context.userId,
        createdBy: context.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        priority: parsed.data.priority,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      });
      await tx.insert(schema.leadTaskAssignees).values(assigneeIds.map((userId) => ({ id: randomUUID(), tenantId: context.tenantId, taskId, userId })));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: taskId, acao: "criou" });
    });
    revalidatePath(`/leads/${lead.id}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a tarefa." };
  }
}

export async function toggleLeadTaskAction(taskId: string): Promise<LeadTaskState> {
  if (!z.string().uuid().safeParse(taskId).success) return { error: "Tarefa inválida." };
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [task] = await db.select({ id: schema.leadTasks.id, leadId: schema.leadTasks.leadId, completedAt: schema.leadTasks.completedAt, assignedTo: schema.leadTasks.assignedTo, tenantId: schema.leadTasks.tenantId, branchId: schema.leads.branchId })
      .from(schema.leadTasks).innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
      .where(and(eq(schema.leadTasks.id, taskId), eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
    if (!task) return { error: "Tarefa não encontrada." };
    if (context.role === "broker" && task.assignedTo !== context.userId) return { error: "Você só pode concluir suas próprias tarefas." };
    if (context.role === "manager" && (!context.branchId || task.branchId !== context.branchId)) return { error: "Esta tarefa não pertence à sua filial." };
    await db.transaction(async (tx) => {
      await tx.update(schema.leadTasks).set({ completedAt: task.completedAt ? null : new Date() }).where(and(eq(schema.leadTasks.id, task.id), eq(schema.leadTasks.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: task.id, acao: task.completedAt ? "reabriu" : "concluiu" });
    });
    revalidatePath(`/leads/${task.leadId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível atualizar a tarefa." };
  }
}
