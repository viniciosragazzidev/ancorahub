"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { criarTarefaDoLead } from "./tarefa-servico";

export type LeadTaskState = { success?: boolean; error?: string };

const taskInput = z.object({
  leadId: z.string().min(1),
  title: z.string().trim().min(3, "Informe um título com ao menos 3 caracteres.").max(160),
  description: z.string().trim().max(1000).optional(),
  dueAt: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "Prazo inválido.").optional(),
  priority: z.enum(["low", "normal", "urgent"]).default("normal"),
  assigneeIds: z.array(z.string().min(1)).max(12).default([]),
});

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
    await criarTarefaDoLead(await getRequiredTenantContext(), parsed.data);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar a tarefa." };
  }
}

export async function toggleLeadTaskAction(taskId: string): Promise<LeadTaskState> {
  return setLeadTaskDone(taskId, "toggle");
}

/**
 * The broker's Agenda: "Já falei" closes the return, swiping it away cancels it
 * and "Desfazer" opens it again. Unlike the toggle, a repeated tap changes nothing.
 */
export async function setLeadTaskDoneAction(taskId: string, mode: "done" | "cancel" | "reopen"): Promise<LeadTaskState> {
  return setLeadTaskDone(taskId, mode);
}

async function setLeadTaskDone(taskId: string, mode: "toggle" | "done" | "cancel" | "reopen"): Promise<LeadTaskState> {
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
    const close = mode === "toggle" ? !task.completedAt : mode !== "reopen";
    if (close === Boolean(task.completedAt)) return { success: true };
    await db.transaction(async (tx) => {
      await tx.update(schema.leadTasks).set({ completedAt: close ? new Date() : null }).where(and(eq(schema.leadTasks.id, task.id), eq(schema.leadTasks.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: task.id, acao: !close ? "reabriu" : mode === "cancel" ? "cancelou_retorno" : "concluiu" });
    });
    return { success: true };
  } catch (error) {
    // Never a technical message to the broker; the detail stays in the server log.
    console.error("[lead-task] update failed", error);
    return { error: "Não foi possível atualizar a tarefa. Tente de novo." };
  }
}
