/**
 * Venda Automatizada (piloto, DEC-182): tipos e limites compartilhados.
 * Plano: docs/implementations/active/2026-11-12-venda-automatizada.md
 */
import { z } from "zod";

import type { QuoteInput, QuoteResult } from "@/features/global-catalog/pilot/contracts";

export type AutoSaleStage = "chosen" | "confirming" | "preferences" | "quoted" | "recommending" | "objections" | "closing" | "documents" | "manager_called" | "handed_off" | "won" | "lost";
export type AutoSaleStatus = "active" | "paused" | "waiting_manager" | "handed_off" | "won" | "lost" | "cancelled";
export type AutoSaleMode = "simulation" | "copilot" | "autopilot";
export type AutoSaleChannel = "meta" | "waha";

export const OPEN_DEAL_STATUSES = ["active", "paused", "waiting_manager"] as const satisfies readonly AutoSaleStatus[];

/** Limites do piloto (D6, D10, D11 do plano). */
export const AUTO_SALE_LIMITS = {
  burstWaitMs: 75_000,
  messagesPerHour: 6,
  messagesPerDay: 25,
  pdfPerDeal: 3,
  audioPerDealPerDay: 10,
  audioMaxSeconds: 300,
  audioMaxBytesWithoutDuration: 5 * 1024 * 1024,
  maxOptions: 3,
  maxQuestions: 4,
  quoteValidityDays: 7,
  misunderstoodBeforeManager: 2,
  guardBlocksBeforeManager: 2,
} as const;

/** Horário de envio (D3): dias úteis das 8h às 21h em São Paulo; sábado e domingo não. */
export const AUTO_SALE_SEND_START_HOUR = 8;
export const AUTO_SALE_SEND_END_HOUR = 21;

/** O que o agente sabe do cliente. Tudo opcional: o agente pergunta o que falta (até 4 perguntas). */
export const dealFactsSchema = z.object({
  firstName: z.string().max(60).optional(),
  city: z.string().max(120).optional(),
  neighborhood: z.string().max(120).optional(),
  ages: z.array(z.number().int().min(0).max(120)).max(30).optional(),
  modality: z.enum(["PESSOA_FISICA", "ADESAO", "PME_EMPRESARIAL"]).optional(),
  entity: z.string().max(200).optional(),
  hasCnpj: z.boolean().optional(),
  businessMonths: z.number().int().min(0).max(2400).optional(),
  budgetCents: z.number().int().positive().max(99_999_999).optional(),
  /** "300 por pessoa" é por pessoa; sem indicação, o orçamento é o total da família. */
  budgetBasis: z.enum(["total", "per_person"]).optional(),
  coparticipation: z.enum(["sem", "parcial", "total", "indiferente"]).optional(),
  accommodation: z.enum(["enfermaria", "apartamento", "indiferente"]).optional(),
  hospital: z.string().max(160).optional(),
  currentPlan: z.string().max(160).optional(),
  currentPriceCents: z.number().int().positive().max(99_999_999).optional(),
  chosenPlanId: z.string().max(80).optional(),
  dueDay: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(20)]).optional(),
  confirmed: z.boolean().optional(),
});
export type DealFacts = z.infer<typeof dealFactsSchema>;

/** Uma opção já cotada, como ficou no snapshot. Preço sempre do `simulate`, em centavos. */
export type OfferPlan = Pick<QuoteResult, "id" | "name" | "operator" | "administrator" | "accommodation" | "coparticipation" | "coverage" | "entity" | "totalCents" | "perLife" | "state" | "reasons">;

export type OfferSnapshot = {
  id: string;
  version: number;
  input: QuoteInput;
  plans: OfferPlan[];
  recommendedPlanId: string | null;
  recommendationReason: string | null;
  relaxed: { filter: string; label: string } | null;
  previousOfferId: string | null;
  previousTotalCents: number | null;
  release: string;
  catalogDate: string;
};

export type Promotion = { id: string; operator: string; title: string; description: string; startsOn: string; endsOn: string };

/** Motivos de chamar o gestor (§11). */
export const MANAGER_CALL_REASONS = {
  documents_received: "Cliente mandou documentos",
  asked_human: "Cliente pediu para falar com uma pessoa",
  objection_off_script: "Objeção fora do roteiro",
  price_off_catalog: "Valor fora do catálogo",
  health_question: "Dúvida de saúde",
  scam_suspicion: "Cliente desconfia de golpe",
  irritation: "Cliente irritado",
  legal_threat: "Cliente citou advogado ou Procon",
  misunderstood: "Duas mensagens sem entender",
  audio_failed: "Áudio que não deu para ouvir",
  guard_blocked: "A IA tentou dizer algo fora das regras",
  stage_timeout: "Negociação parada além do tempo",
  channel_unavailable: "Canal indisponível",
  accepted: "Cliente aceitou: hora da assinatura",
} as const;
export type ManagerCallReason = keyof typeof MANAGER_CALL_REASONS;

export const STAGE_LABEL: Record<AutoSaleStage, string> = {
  chosen: "Escolhido",
  confirming: "Confirmando dados",
  preferences: "Preferências",
  quoted: "Cotação enviada",
  recommending: "Recomendação",
  objections: "Objeções",
  closing: "Pedido de fechamento",
  documents: "Documentos",
  manager_called: "Chamou o gestor",
  handed_off: "Entregue",
  won: "Ganho",
  lost: "Perdido",
};

export const STATUS_LABEL: Record<AutoSaleStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  waiting_manager: "Aguardando você",
  handed_off: "Entregue",
  won: "Ganha",
  lost: "Perdida",
  cancelled: "Encerrada",
};

export const MODE_LABEL: Record<AutoSaleMode, string> = { simulation: "Simulação", copilot: "Copiloto", autopilot: "Autopiloto" };
export const CHANNEL_LABEL: Record<AutoSaleChannel, string> = { meta: "Meta oficial", waha: "WAHA" };

export function formatCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ");
}
