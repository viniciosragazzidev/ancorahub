import "server-only";

import { after } from "next/server";

import { dispatchAutoSaleOutbox } from "./dispatch";
import { getDeal } from "./repository";
import { runDealTurn } from "./runner";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resposta na hora (13/11, pedido do Vinicios): depois da última mensagem da rajada, o próprio servidor responde e
 * envia, sem esperar a rodada do robô agendado. Mensagem nova no meio empurra o prazo e esta tentativa desiste (a da
 * mensagem nova responde). O robô agendado continua como rede de segurança; o turno é reivindicado pelo prazo, então
 * os dois nunca respondem duas vezes.
 */
export function scheduleQuickReply(tenantId: string, dealId: string, waitMs: number) {
  const run = async () => {
    await sleep(waitMs + 1_500);
    const deal = await getDeal(tenantId, dealId);
    if (!deal || deal.status !== "active" || !deal.replyDueAt || deal.replyDueAt > new Date()) return;
    await runDealTurn(deal);
    await dispatchAutoSaleOutbox(new Date(Date.now() + 10_000), 10, dealId);
  };
  const guarded = () => run().catch((error) => console.warn("[auto-sale] quick_reply_failed", { dealId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  try {
    after(guarded);
  } catch {
    // Fora de uma requisição (ex.: entrada processada por um robô): segue no próprio processo do servidor.
    void guarded();
  }
}
