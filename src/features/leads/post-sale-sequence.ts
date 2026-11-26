import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";

import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import {
  planPostSaleSequence,
  POST_SALE_SEQUENCE_SKIP_LABELS,
  postSaleSequenceSettingKey,
  postSaleSequenceTaskPrefix,
  resolvePostSaleSequenceSettings,
  type PostSaleSequencePlan,
  type PostSaleSequenceSettings,
} from "./post-sale-sequence-core";

/** Configuração da empresa (system_settings), com o padrão ligado quando não há nada salvo ou a leitura falha. */
export async function getPostSaleSequenceSettings(tenantId: string): Promise<PostSaleSequenceSettings> {
  try {
    return resolvePostSaleSequenceSettings(await getSystemSetting(postSaleSequenceSettingKey(tenantId)));
  } catch {
    return resolvePostSaleSequenceSettings(null);
  }
}

export type PostSaleSequenceResult = PostSaleSequencePlan | { kind: "failed"; reason: string };

/**
 * Cria as tarefas da sequência de pós-venda para o corretor dono do lead que virou venda. Roda depois do commit da
 * conversão, fora da transação dela: nunca lança erro, e a falha fica registrada (log e auditoria) com o motivo.
 * Idempotente por lead: ids fixos por passo e onConflictDoNothing, e nada se a sequência já começou.
 */
export async function startPostSaleSequence(input: {
  tenantId: string;
  leadId: string;
  convertedAt: Date;
  actorUserId?: string | null;
}): Promise<PostSaleSequenceResult> {
  let ownerId: string | null = null;
  try {
    const db = getDatabase();
    const settings = await getPostSaleSequenceSettings(input.tenantId);
    if (!settings.enabled) return { kind: "skip", reason: "desligada" };

    const [lead] = await db.select({ id: schema.leads.id, status: schema.leads.status, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    if (!lead) return { kind: "failed", reason: "Lead não encontrado." };
    ownerId = lead.corretorId;

    const existing = await db.select({ id: schema.leadTasks.id })
      .from(schema.leadTasks)
      .where(and(
        eq(schema.leadTasks.tenantId, input.tenantId),
        eq(schema.leadTasks.leadId, lead.id),
        like(schema.leadTasks.id, `${postSaleSequenceTaskPrefix(lead.id)}%`),
      ));
    const plan = planPostSaleSequence({ settings, lead, existingTaskIds: existing.map((row) => row.id), convertedAt: input.convertedAt });
    if (plan.kind === "skip") {
      if (plan.reason === "sem_corretor") console.info("[post-sale-sequence] skipped", { tenantId: input.tenantId, leadId: lead.id, reason: POST_SALE_SEQUENCE_SKIP_LABELS[plan.reason] });
      return plan;
    }

    const assignedTo = lead.corretorId!;
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadTasks).values(plan.tasks.map((task) => ({
        id: task.id,
        tenantId: input.tenantId,
        leadId: lead.id,
        assignedTo,
        createdBy: input.actorUserId ?? assignedTo,
        title: task.title,
        description: "Sequência de pós-venda",
        priority: "normal" as const,
        dueAt: task.dueAt,
        createdAt: now,
        updatedAt: now,
      }))).onConflictDoNothing({ target: schema.leadTasks.id });
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: input.actorUserId ?? assignedTo,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "pos_venda_sequencia_criada",
        metadata: { tenantId: input.tenantId, tasks: plan.tasks.map((task) => ({ id: task.id, dueAt: task.dueAt.toISOString() })) },
      });
    });
    return plan;
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 200) : "Falha desconhecida.";
    console.warn("[post-sale-sequence] failed", { tenantId: input.tenantId, leadId: input.leadId, reason });
    const auditUser = input.actorUserId ?? ownerId;
    if (auditUser) {
      await getDatabase().insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: auditUser,
        entidade: "lead",
        entidadeId: input.leadId,
        acao: "pos_venda_sequencia_falhou",
        metadata: { tenantId: input.tenantId, reason },
      }).catch(() => { /* o log acima já guarda o motivo */ });
    }
    return { kind: "failed", reason };
  }
}
