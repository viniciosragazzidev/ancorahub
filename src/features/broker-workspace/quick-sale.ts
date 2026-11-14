import { z } from "zod";

import type { BROKER_WALLET_NEGOTIATING_STAGES } from "@/features/customers/broker-wallet-filters";

/**
 * Registrar venda em dois toques (plano "Início do corretor e CRM", parte B). A lista mostra os leads do próprio
 * corretor em negociação, os mais adiantados no funil primeiro. Novo e Distribuído ficam de fora: antes do aceite
 * o lead não abre o registro de venda.
 */
export const QUICK_SALE_STAGES = [
  "under_analysis",
  "documentation_pending",
  "negotiation",
  "quote_sent",
  "awaiting_reply",
  "in_contact",
] as const satisfies readonly (typeof BROKER_WALLET_NEGOTIATING_STAGES)[number][];
export type QuickSaleStage = (typeof QUICK_SALE_STAGES)[number];

export const QUICK_SALE_LIMIT = 30;
/** Parâmetro que a tela do lead lê para abrir o registro de venda. */
export const QUICK_SALE_PARAM = "registrar-venda";

export function quickSaleLeadHref(leadId: string) {
  return `/leads/${encodeURIComponent(leadId)}?${QUICK_SALE_PARAM}=1`;
}

export const quickSaleInputSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
}).strict();
export type QuickSaleInput = z.input<typeof quickSaleInputSchema>;

export type QuickSaleLead = { id: string; name: string; status: QuickSaleStage };
export type QuickSaleResult = { ok: true; leads: QuickSaleLead[] } | { ok: false; error: string };

/** Posição no funil, do mais adiantado (0) ao mais cedo. */
export function quickSaleStageRank(status: string) {
  const index = (QUICK_SALE_STAGES as readonly string[]).indexOf(status);
  return index === -1 ? QUICK_SALE_STAGES.length : index;
}

export type QuickSaleOpenInput = {
  registrationV2Enabled: boolean;
  isCurrentBroker: boolean;
  /** Novo ou Distribuído: o lead ainda não foi aceito. */
  isDistributed: boolean;
  leadStatus: string;
  hasActiveSale: boolean;
  aiSalePrompt: "register" | "confirm" | "check" | null;
  hasApprovedDocument: boolean;
  hasRejectedDocument: boolean;
};

/** `confirm`: o que `setShowSaleConfirm(true)` abre (assistente ou painel). `request-document`: o Registrar venda do fluxo anterior. */
export type QuickSaleOpenDecision = { open: "confirm" | "request-document" } | { open: null; reason: string };

/**
 * O que o atalho `?registrar-venda=1` abre na tela do lead. Repete as condições dos botões da seção Etapa atual
 * (`SaleSection`) sem mudar nenhuma: se o botão não aparece, o atalho só explica por quê.
 */
export function quickSaleOpenDecision(input: QuickSaleOpenInput): QuickSaleOpenDecision {
  const { leadStatus } = input;
  if (!input.isCurrentBroker) return { open: null, reason: "Este lead não está com você, então a venda não pode ser registrada por aqui." };
  if (input.isDistributed) return { open: null, reason: "Aceite o lead antes de registrar a venda." };
  if (leadStatus === "lost") return { open: null, reason: "Este lead está como perdido e não registra venda." };

  if (input.registrationV2Enabled) {
    if (input.hasActiveSale) return { open: null, reason: "Já existe uma venda em andamento para este lead. Acompanhe pela seção Etapa atual." };
    if (leadStatus === "converted" && input.aiSalePrompt !== "register") return { open: null, reason: "A venda deste lead já foi registrada." };
    return { open: "confirm" };
  }

  if (leadStatus === "converted") {
    return input.aiSalePrompt === "register" ? { open: "confirm" } : { open: null, reason: "A venda deste lead já foi registrada." };
  }
  if (input.hasApprovedDocument) return { open: "confirm" };
  // O aviso da IA antes do desfecho ("confirm" e "check"); "register" só vale com o lead Convertido.
  if (input.aiSalePrompt === "confirm" || input.aiSalePrompt === "check") return { open: "confirm" };
  if (input.hasRejectedDocument) return { open: null, reason: "A documentação foi rejeitada. Reenvie os documentos pela seção Etapa atual." };
  if (leadStatus === "documentation_pending") return { open: null, reason: "A documentação deste lead está em análise pelo supervisor." };
  return { open: "request-document" };
}
