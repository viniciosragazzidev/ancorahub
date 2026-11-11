import "server-only";

import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { autorizarTarefaDoLead, criarTarefaDoLead } from "@/features/leads/tarefa-servico";

import {
  classifyNextAction,
  isRecentEquivalentReturn,
  RETORNO_REPEAT_WINDOW_MS,
  validateReturnDueAt,
  type NextActionView,
} from "./proxima-acao-core";
import {
  findRecentEquivalentReturn,
  loadLeadOwner,
  loadOpenReturnForBroker,
  loadReturnTask,
  updateReturnDueAt,
  withReturnCreateLock,
} from "./retorno-queries";

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

/**
 * Próxima ação do lead para o corretor dono. Se o lead saiu da carteira (transferência), devolve `not_owner`,
 * sem ações e com texto claro. Falha técnica continua como erro (a ficha mostra "Tentar de novo").
 */
export async function carregarProximaAcao(context: TenantContext, leadId: string): Promise<NextActionView> {
  await exigirCarteiraLiteDoCorretor(context);
  const owner = await loadLeadOwner(context.tenantId, leadId);
  if (!owner) throw new CarteiraRetornoError("Lead não encontrado.");
  if (owner.corretorId !== context.userId) {
    return { state: "not_owner", taskId: null, title: null, dueAt: null, reason: "Este cliente não está mais na sua carteira." };
  }
  await autorizarTarefaDoLead(context, leadId);
  const task = await loadOpenReturnForBroker(context.tenantId, leadId, context.userId);
  return classifyNextAction(task ? { id: task.id, title: task.title, dueAt: task.dueAt } : null, new Date());
}

/**
 * Agenda o retorno como tarefa canônica do lead. A criação é serializada por (tenant, lead, corretor): uma
 * repetição do mesmo pedido dentro da janela (duplo clique, retry, duas abas) devolve o retorno já criado.
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

  return withReturnCreateLock(context.tenantId, input.leadId, context.userId, async () => {
    const since = new Date(now.getTime() - RETORNO_REPEAT_WINDOW_MS);
    const twin = await findRecentEquivalentReturn({ tenantId: context.tenantId, leadId: input.leadId, title: RETORNO_TITULO_PADRAO, dueAt: due.dueAt, since });
    if (twin && isRecentEquivalentReturn(twin, { title: RETORNO_TITULO_PADRAO, dueAt: due.dueAt }, now)) {
      return { taskId: twin.id, repeated: true };
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
  });
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
