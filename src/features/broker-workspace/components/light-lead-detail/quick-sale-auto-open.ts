"use client";

import { useEffect, useRef } from "react";

import { toast } from "@/components/ui/sonner";
import { QUICK_SALE_PARAM, quickSaleOpenDecision } from "@/features/broker-workspace/quick-sale";

import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

/** Tira `?registrar-venda=1` da barra sem criar entrada no histórico (voltar não reabre o registro). */
export function clearQuickSaleParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(QUICK_SALE_PARAM)) return;
  url.searchParams.delete(QUICK_SALE_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Registrar venda em dois toques: com o atalho (chave ligada, conferida no servidor), abre uma vez o mesmo fluxo do
 * botão da seção Etapa atual. Quando o botão não estaria disponível, só explica o motivo.
 */
export function useQuickSaleAutoOpen({
  enabled,
  lead,
  c,
  registrationV2Enabled,
}: {
  enabled: boolean;
  lead: Pick<LightLeadDetailData, "isCurrentBroker" | "hasActiveSale" | "aiSalePrompt">;
  c: Pick<LeadDetailController, "isDistributed" | "leadStatus" | "approvedDocument" | "rejectedDocument" | "setShowSaleConfirm" | "handleRequestSale">;
  registrationV2Enabled: boolean;
}) {
  const handled = useRef(false);
  useEffect(() => {
    if (!enabled || handled.current) return;
    handled.current = true;
    clearQuickSaleParam();
    const decision = quickSaleOpenDecision({
      registrationV2Enabled,
      isCurrentBroker: lead.isCurrentBroker,
      isDistributed: c.isDistributed,
      leadStatus: c.leadStatus,
      hasActiveSale: Boolean(lead.hasActiveSale),
      aiSalePrompt: lead.aiSalePrompt ?? null,
      hasApprovedDocument: Boolean(c.approvedDocument),
      hasRejectedDocument: Boolean(c.rejectedDocument),
    });
    if (decision.open === null) toast.info(decision.reason);
    else if (decision.open === "confirm") c.setShowSaleConfirm(true);
    else c.handleRequestSale();
    // Só na chegada à tela: mudanças depois disso não reabrem o registro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
