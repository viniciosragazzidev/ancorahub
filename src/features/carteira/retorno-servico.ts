import "server-only";

import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { autorizarTarefaDoLead, criarTarefaDoLead } from "@/features/leads/tarefa-servico";

import { classifyNextAction, isRepeatedReturn, validateReturnDueAt, type NextActionView } from "./proxima-acao-core";
import { loadOpenReturnForBroker, loadReturnTask, updateReturnDueAt } from "./retorno-queries";

/** Erro com mensagem para o corretor. Qualquer outro erro vira mensagem genérica na action. */
export class CarteiraRetornoError extends Error {}

export const RETORNO_TITULO_PADRAO = "Retorno";

export async function carteiraFichaLiteLigada(): Promise<boolean> {
  return (await getFeatureFlag(FEATURE_FLAGS.BROKER_CLIENT_WALLET_LITE).catch(() => "false")) === "true";
}

async function exigirCarteiraLiteDoCorretor(context: TenantContext) {
  if (context.role !== "broker") throw new CarteiraRetornoError("Esta ação é do corretor dono da carteira.");
  if (!(await carteiraFichaLiteLigada())) throw new CarteiraRetornoError("A ficha da carteira não está disponível no momento.");
}

/** Próxima ação do lead para o corretor dono (escopo revalidado; outro corretor ou tenant não vê nada). */
export async function carregarProximaAcao(context: TenantContext, leadId: string): Promise<NextActionView> {
  await exigirCarteiraLiteDoCorretor(context);
  await autorizarTarefaDoLead(context, leadId);
  const task = await loadOpenReturnForBroker(context.tenantId, leadId, context.userId);
  return classifyNextAction(task ? { id: task.id, title: task.title, dueAt: task.dueAt } : null, new Date());
}

/**
 * Agenda o retorno como tarefa canônica do lead. Repetir o mesmo pedido dentro da janela (duplo clique ou retry)
 * devolve o retorno já criado, sem novo registro.
 */
export async function agendarRetorno(
  context: TenantContext,
  input: { leadId: string; dueAt: string | null; note?: string | null },
  now = new Date(),
): Promise<{ taskId: string; repeated: boolean }> {
  await exigirCarteiraLiteDoCorretor(context);
  const due = validateReturnDueAt(input.dueAt, now);
  if (!due.ok) throw new CarteiraRetornoError(due.reason);
  await autorizarTarefaDoLead(context, input.leadId);

  const existing = await loadOpenReturnForBroker(context.tenantId, input.leadId, context.userId);
  if (existing && isRepeatedReturn(existing, { title: RETORNO_TITULO_PADRAO, dueAt: due.dueAt, userId: context.userId }, now)) {
    return { taskId: existing.id, repeated: true };
  }

  const description = input.note?.trim() ? input.note.trim().slice(0, 1000) : undefined;
  const { taskId } = await criarTarefaDoLead(context, {
    leadId: input.leadId,
    title: RETORNO_TITULO_PADRAO,
    description,
    dueAt: due.dueAt.toISOString(),
    priority: "normal",
    assigneeIds: [context.userId],
  });
  return { taskId, repeated: false };
}

/** Reagenda um retorno aberto do próprio corretor. Mesmo prazo de novo não grava nada. */
export async function reagendarRetorno(context: TenantContext, input: { taskId: string; dueAt: string | null }, now = new Date()): Promise<{ changed: boolean }> {
  await exigirCarteiraLiteDoCorretor(context);
  const due = validateReturnDueAt(input.dueAt, now);
  if (!due.ok) throw new CarteiraRetornoError(due.reason);

  const task = await loadReturnTask(context.tenantId, input.taskId);
  if (!task) throw new CarteiraRetornoError("Retorno não encontrado.");
  if (task.assignedTo !== context.userId) throw new CarteiraRetornoError("Você só pode reagendar os seus retornos.");
  await autorizarTarefaDoLead(context, task.leadId);
  if (task.completedAt) throw new CarteiraRetornoError("Este retorno já foi concluído.");
  if (task.dueAt && task.dueAt.getTime() === due.dueAt.getTime()) return { changed: false };

  const changed = await updateReturnDueAt({ tenantId: context.tenantId, taskId: task.id, brokerId: context.userId, dueAt: due.dueAt, actorId: context.userId });
  if (!changed) throw new CarteiraRetornoError("Este retorno foi concluído ou alterado. Atualize a ficha.");
  return { changed: true };
}
