import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";

import { readAutoSaleFlags } from "./flag";
import { getOpenDealForLead } from "./repository";
import { recordTurn } from "./service";

/**
 * Entrada da Meta e do WAHA (§8): com uma negociação aberta, a mensagem é da Venda Automatizada.
 * Grava o turno (idempotente por mensagem) e marca o fim da rajada; o job responde depois.
 * Falha fechado (revisão do plano): com negociação existente, sempre captura, mesmo pausada,
 * aguardando o gestor ou com o kill switch desligado, para nunca haver dois agentes na conversa.
 * Devolve false só quando não há negociação (ou a migração não foi aplicada).
 */
export async function routeAutoSaleInbound(input: { tenantId: string; leadId: string | null | undefined; providerMessageId: string | null | undefined; body: string | null | undefined; messageKind: string | null | undefined }): Promise<boolean> {
  if (!input.leadId) return false;
  let deal;
  try {
    deal = await getOpenDealForLead(input.tenantId, input.leadId);
  } catch (error) {
    if (isUndefinedTableError(error)) return false;
    console.error("[auto-sale] inbound_lookup_failed", { tenantId: input.tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return false;
  }
  if (!deal) return false;
  const now = new Date();
  const kind = input.messageKind === "audio" ? "audio" : input.messageKind && input.messageKind !== "text" ? `media:${input.messageKind}` : "message";
  const turnId = await recordTurn(deal, { direction: "in", kind, body: input.body?.slice(0, 4000) ?? null, providerMessageId: input.providerMessageId ?? null });
  if (!turnId) return true; // mesma mensagem de novo: já registrada.
  const { settings } = await readAutoSaleFlags(input.tenantId);
  await getDatabase().update(schema.autoSaleDeals).set({
    lastCustomerMessageAt: now,
    // Rajada: cada mensagem nova empurra a resposta (20 s sem mensagem nova). Pausada ou aguardando o gestor, não responde.
    replyDueAt: deal.status === "active" ? new Date(now.getTime() + settings.burstWaitSeconds * 1000) : null,
    nextFollowUpAt: null,
    // Cliente respondeu: a cadência recomeça no passo de 20 h (o de 45 min é só logo após a cotação).
    followUpStep: sql`case when ${schema.autoSaleDeals.firstQuoteAt} is null then 0 else 1 end`,
    updatedAt: now,
  }).where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, input.tenantId)));
  // Responde assim que a rajada termina, sem esperar o robô agendado.
  if (deal.status === "active") {
    const { scheduleQuickReply } = await import("./quick-reply");
    scheduleQuickReply(input.tenantId, deal.id, settings.burstWaitSeconds * 1000);
  }
  return true;
}
