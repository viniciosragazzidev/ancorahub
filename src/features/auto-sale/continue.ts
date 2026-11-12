import "server-only";

import { and, asc, eq, gte, inArray, isNull, ne, or } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { dispatchAutoSaleOutbox } from "./dispatch";
import { HOLD_MESSAGE } from "./quote-messages";
import { getDeal } from "./repository";
import { runDealTurn } from "./runner";
import { AutoSaleError, audit, loadDealForManager, recordTurn, setDealPaused } from "./service";

const INBOUND_DIRECTIONS = ["incoming", "inbound"];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ContinueOutcome = { answered: boolean; sent: number; drafts: number; held: string[]; waitingCustomer: boolean };

/**
 * "Continuar atendimento" (pedido do Vinicios, 12/11): o gestor manda a assistente seguir agora, sem esperar o
 * robô agendado. Devolve ao agente se estava pausada ou chamando o gestor, traz para a negociação as mensagens do
 * cliente que chegaram e ainda não estão nela (ex.: o "Ok" logo depois da captura), responde o que está sem
 * resposta e despacha o que já pode sair. Copiloto continua pedindo aprovação; nada passa o lead a corretor.
 */
export async function continueDeal(context: TenantContext, dealId: string): Promise<ContinueOutcome> {
  let deal = await loadDealForManager(context, dealId);
  if (!["active", "paused", "waiting_manager"].includes(deal.status)) throw new AutoSaleError("A negociação já foi encerrada.");
  if (deal.status !== "active") await setDealPaused(context, deal.id, false);
  const db = getDatabase();

  // Mensagens do cliente desde o início da negociação que não viraram turno (chegaram por outro caminho).
  const known = new Set((await db.select({ id: schema.autoSaleTurns.providerMessageId }).from(schema.autoSaleTurns)
    .where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.tenantId, context.tenantId), eq(schema.autoSaleTurns.direction, "in"))))
    .map((row) => row.id).filter(Boolean));
  const inbound = await db.select({ messageId: schema.whatsappMessages.messageId, body: schema.whatsappMessages.body, mediaKind: schema.whatsappMessages.mediaKind })
    .from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, deal.leadId), inArray(schema.whatsappMessages.direction, INBOUND_DIRECTIONS), gte(schema.whatsappMessages.sentAt, deal.createdAt)))
    .orderBy(asc(schema.whatsappMessages.sentAt)).limit(30);
  let imported = 0;
  for (const message of inbound) {
    if (!message.messageId || known.has(message.messageId)) continue;
    const kind = message.mediaKind === "audio" ? "audio" : message.mediaKind ? `media:${message.mediaKind}` : "message";
    if (await recordTurn(deal, { direction: "in", kind, body: message.body?.slice(0, 4000) ?? null, providerMessageId: message.messageId })) imported += 1;
  }

  const [pending] = await db.select({ id: schema.autoSaleTurns.id }).from(schema.autoSaleTurns)
    .where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.direction, "in"), eq(schema.autoSaleTurns.tenantId, context.tenantId), isNull(schema.autoSaleTurns.processedAt))).limit(1);
  let answered = false;
  if (pending) {
    const now = new Date();
    await db.update(schema.autoSaleDeals).set({ replyDueAt: now, updatedAt: now }).where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, context.tenantId)));
    deal = (await getDeal(context.tenantId, deal.id))!;
    const outcome = await runDealTurn(deal, { now });
    answered = !["skipped", "nothing", "disabled", "deferred"].includes(outcome.status);
  }

  // O que ficou retido (janela da Meta, limite, canal) tenta de novo agora: já tinha sido aprovado antes de reter.
  const retried = new Date();
  await db.update(schema.autoSaleOutbox).set({ status: "approved", holdReason: null, scheduledAt: retried, updatedAt: retried })
    .where(and(eq(schema.autoSaleOutbox.dealId, deal.id), eq(schema.autoSaleOutbox.tenantId, context.tenantId), eq(schema.autoSaleOutbox.status, "held"), or(isNull(schema.autoSaleOutbox.body), ne(schema.autoSaleOutbox.body, HOLD_MESSAGE))));

  // Despacha o que já está aprovado; as mensagens de um turno saem espaçadas (3 s), então espera as próximas.
  let sent = 0;
  for (let round = 0; round < 5; round += 1) {
    sent += (await dispatchAutoSaleOutbox(new Date(), 20, deal.id)).sent;
    const [due] = await db.select({ id: schema.autoSaleOutbox.id }).from(schema.autoSaleOutbox)
      .where(and(eq(schema.autoSaleOutbox.dealId, deal.id), eq(schema.autoSaleOutbox.status, "approved"))).limit(1);
    if (!due) break;
    await sleep(3_100);
  }
  const rest = await db.select({ status: schema.autoSaleOutbox.status, holdReason: schema.autoSaleOutbox.holdReason }).from(schema.autoSaleOutbox)
    .where(and(eq(schema.autoSaleOutbox.dealId, deal.id), eq(schema.autoSaleOutbox.tenantId, context.tenantId), inArray(schema.autoSaleOutbox.status, ["draft", "held"])));
  const held = [...new Set(rest.filter((row) => row.status === "held" && row.holdReason).map((row) => row.holdReason!))];
  const drafts = rest.filter((row) => row.status === "draft").length;
  await audit(context.userId, deal.id, "auto_sale.continued", { leadId: deal.leadId, imported, answered, sent, drafts });
  return { answered, sent, drafts, held, waitingCustomer: !pending && !sent && !drafts && !held.length };
}
