"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCargoCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { distributeWaitingQueueLeads } from "./control-service";
import { queueModeProblem } from "./queue-mode";

const input = z.object({ queueId: z.string().uuid(), mode: z.enum(["automatic", "manual"]) });

/**
 * Gestor (05/11): escolhe se a fila da unidade distribui sozinha ou espera atribuição manual.
 * Só fila gravada na unidade dele; o resto da configuração da fila continua com o Diretor.
 */
export async function setUnitQueueModeAction(raw: unknown): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { queueId, mode } = input.parse(raw);
    const context = await getRequiredTenantContext();
    await requireCargoCapability(context, "lead_queues_manage");
    const db = getDatabase();
    const [queue] = await db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, status: schema.leadQueues.status, assignmentMode: schema.leadQueues.assignmentMode })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.id, queueId), eq(schema.leadQueues.tenantId, context.tenantId)))
      .limit(1);
    const problem = queueModeProblem({ role: context.role, actorBranchId: context.branchId ?? null, queue: queue ?? null });
    if (problem) return { ok: false, reason: problem };
    if (queue!.assignmentMode === mode) return { ok: true };
    await db.update(schema.leadQueues).set({ assignmentMode: mode, updatedAt: new Date() }).where(eq(schema.leadQueues.id, queue!.id));
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_queue", entidadeId: queue!.id, acao: mode === "automatic" ? "queue.mode_automatic" : "queue.mode_manual" });
    if (mode === "automatic") await distributeWaitingQueueLeads(db, context.tenantId, queue!.id);
    revalidatePath("/leads/distribuicao");
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível mudar a distribuição da fila." };
  }
}
