import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

export type NovaTarefa = {
  leadId: string;
  title: string;
  description?: string;
  dueAt?: string;
  priority: "low" | "normal" | "urgent";
  assigneeIds: string[];
};

/**
 * Conexão de trabalho: a do pool (padrão) ou uma transação que o chamador já abriu. Com a transação, tudo roda
 * nela, sem pedir outra conexão ao pool.
 */
export type TarefaExecutor = Pick<ReturnType<typeof getDatabase>, "select" | "insert">;

/** Lead do tenant que o usuário pode gerenciar (corretor: só os seus; gestor: só da unidade). */
export async function autorizarTarefaDoLead(context: TenantContext, leadId: string, executor?: TarefaExecutor) {
  const db = executor ?? getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  if (context.role === "broker" && lead.corretorId !== context.userId) throw new Error("Você só pode gerenciar tarefas dos seus leads.");
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) throw new Error("Este lead não pertence à sua filial.");
  return { db, lead };
}

/**
 * Cria a tarefa do lead com as regras de responsáveis e prioridade. Lança Error com a mensagem para o usuário.
 * Sem `executor`, abre a própria transação (comportamento de sempre). Com `executor` (transação do chamador),
 * grava dentro dela e não abre outra conexão.
 */
export async function criarTarefaDoLead(context: TenantContext, entrada: NovaTarefa, executor?: TarefaExecutor) {
  const { db, lead } = await autorizarTarefaDoLead(context, entrada.leadId, executor);
  const assigneeIds = [...new Set(entrada.assigneeIds.length ? entrada.assigneeIds : [lead.corretorId ?? context.userId])];
  if (entrada.priority !== "urgent" && assigneeIds.length > 1) throw new Error("Apenas tarefas urgentes podem ter mais de um responsável.");
  if (context.role === "broker" && (assigneeIds.length !== 1 || assigneeIds[0] !== context.userId)) throw new Error("Você só pode atribuir tarefas a si mesmo.");
  const elegiveis = await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.userId, assigneeIds), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), ...(lead.branchId ? [eq(schema.tenantMemberships.branchId, lead.branchId)] : [])));
  if (elegiveis.length !== assigneeIds.length) throw new Error("Um ou mais responsáveis não estão ativos nesta filial.");
  const taskId = randomUUID();
  const gravar = async (w: TarefaExecutor) => {
    await w.insert(schema.leadTasks).values({
      id: taskId,
      tenantId: context.tenantId,
      leadId: lead.id,
      assignedTo: lead.corretorId ?? context.userId,
      createdBy: context.userId,
      title: entrada.title,
      description: entrada.description || null,
      priority: entrada.priority,
      dueAt: entrada.dueAt ? new Date(entrada.dueAt) : null,
    });
    await w.insert(schema.leadTaskAssignees).values(assigneeIds.map((userId) => ({ id: randomUUID(), tenantId: context.tenantId, taskId, userId })));
    await w.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: taskId, acao: "criou" });
  };
  if (executor) {
    await gravar(executor);
  } else {
    await getDatabase().transaction(async (tx) => gravar(tx));
  }
  return { taskId };
}
