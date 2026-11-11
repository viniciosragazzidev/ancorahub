import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export type OpenReturn = { id: string; title: string; dueAt: Date | null; createdAt: Date; createdBy: string; completedAt: Date | null };

/** Retorno aberto mais próximo do corretor neste lead (sem prazo por último). */
export async function loadOpenReturnForBroker(tenantId: string, leadId: string, brokerId: string): Promise<OpenReturn | null> {
  const [row] = await getDatabase().select({
    id: schema.leadTasks.id,
    title: schema.leadTasks.title,
    dueAt: schema.leadTasks.dueAt,
    createdAt: schema.leadTasks.createdAt,
    createdBy: schema.leadTasks.createdBy,
    completedAt: schema.leadTasks.completedAt,
  }).from(schema.leadTasks).where(and(
    eq(schema.leadTasks.tenantId, tenantId),
    eq(schema.leadTasks.leadId, leadId),
    eq(schema.leadTasks.assignedTo, brokerId),
    isNull(schema.leadTasks.completedAt),
  )).orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`, asc(schema.leadTasks.createdAt)).limit(1);
  return row ?? null;
}

/** Tarefa do corretor usada para reagendar (a leitura confere tenant e dono depois). */
export async function loadReturnTask(tenantId: string, taskId: string) {
  const [row] = await getDatabase().select({
    id: schema.leadTasks.id,
    leadId: schema.leadTasks.leadId,
    assignedTo: schema.leadTasks.assignedTo,
    dueAt: schema.leadTasks.dueAt,
    completedAt: schema.leadTasks.completedAt,
  }).from(schema.leadTasks).where(and(eq(schema.leadTasks.id, taskId), eq(schema.leadTasks.tenantId, tenantId))).limit(1);
  return row ?? null;
}

/** Muda o prazo só se a tarefa ainda estiver aberta e for do corretor (a condição é repetida no UPDATE). */
export async function updateReturnDueAt(input: { tenantId: string; taskId: string; brokerId: string; dueAt: Date; actorId: string }): Promise<boolean> {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const updated = await tx.update(schema.leadTasks).set({ dueAt: input.dueAt, updatedAt: new Date() }).where(and(
      eq(schema.leadTasks.id, input.taskId),
      eq(schema.leadTasks.tenantId, input.tenantId),
      eq(schema.leadTasks.assignedTo, input.brokerId),
      isNull(schema.leadTasks.completedAt),
    )).returning({ id: schema.leadTasks.id });
    if (!updated.length) return false;
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorId, entidade: "lead_task", entidadeId: input.taskId, acao: "reagendou" });
    return true;
  });
}
