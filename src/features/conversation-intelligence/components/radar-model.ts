/**
 * Regras do Radar IA (leitura da IA por negociação, contadores e filtros), as mesmas do Radar atual, para a versão
 * Lite do diretor. O Radar atual mantém a própria cópia para não mudar o HTML com a chave desligada.
 */
import type { RadarDealItem } from "./negotiations-radar-tab";

export type RadarFilter = "all" | "hot" | "risk" | "broker_pending";

export const intentTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  VERY_HIGH: "success",
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "neutral",
  NONE: "danger",
  UNKNOWN: "neutral",
};

/** Mesmos rótulos do Radar atual, em sentence case. */
export const intentLabel: Record<string, string> = {
  VERY_HIGH: "Fechamento iminente",
  HIGH: "Alta intenção",
  MEDIUM: "Intenção média",
  LOW: "Baixa intenção",
  NONE: "Desinteresse",
  UNKNOWN: "Intenção pendente",
};

export const stageLabel: Record<string, string> = {
  INITIAL_CONTACT: "1º contato",
  DISCOVERY: "Descoberta",
  QUALIFICATION: "Qualificação",
  QUOTE_PREPARATION: "Montagem de cotação",
  QUOTE_PRESENTED: "Cotação apresentada",
  NEGOTIATION: "Negociação",
  DOCUMENT_COLLECTION: "Coleta de documentos",
  CLOSING: "Fechamento",
  POST_SALE: "Pós-venda",
  UNKNOWN: "Em andamento",
};

type Intelligence = {
  customerIntent?: string;
  conversationStage?: string;
  sentiment?: string;
  summary?: string;
  nextBestAction?: string;
  risk?: string;
  pendingFrom?: string;
  objections?: unknown[];
  buyingSignals?: unknown[];
} | null;

export function enrichRadarLeads(leads: RadarDealItem[]) {
  return leads.map((lead) => {
    const qual = (lead.qualificationDetails as Record<string, unknown> | null) || {};
    const ai = (qual.aiIntelligence as Intelligence) || null;
    const isHot = ai?.customerIntent === "VERY_HIGH" || ai?.customerIntent === "HIGH" || ai?.conversationStage === "CLOSING";
    const hasRisk = Boolean(ai?.risk) || ai?.sentiment === "NEGATIVE";
    const isBrokerPending = ai?.pendingFrom === "BROKER";
    return {
      ...lead,
      isHot,
      hasRisk,
      isBrokerPending,
      intent: ai?.customerIntent || "UNKNOWN",
      stage: ai?.conversationStage || "UNKNOWN",
      summary: ai?.summary || null,
      nextBestAction: ai?.nextBestAction || null,
      riskReason: ai?.risk || null,
    };
  });
}

export type EnrichedRadarLead = ReturnType<typeof enrichRadarLeads>[number];

export function radarStats(leads: EnrichedRadarLead[]) {
  return {
    total: leads.length,
    hotCount: leads.filter((lead) => lead.isHot).length,
    riskCount: leads.filter((lead) => lead.hasRisk).length,
    brokerPendingCount: leads.filter((lead) => lead.isBrokerPending).length,
  };
}

export function filterRadarLeads(leads: EnrichedRadarLead[], input: { type: RadarFilter; branch: string; broker: string; query: string }) {
  const query = input.query.toLowerCase().trim();
  return leads.filter((lead) => {
    if (input.type === "hot" && !lead.isHot) return false;
    if (input.type === "risk" && !lead.hasRisk) return false;
    if (input.type === "broker_pending" && !lead.isBrokerPending) return false;
    if (input.branch !== "all" && lead.branchId !== input.branch) return false;
    if (input.broker !== "all" && lead.corretorId !== input.broker) return false;
    if (query) {
      const matches = [lead.nome, lead.telefone, lead.corretorNome, lead.summary].some((value) => value?.toLowerCase().includes(query));
      if (!matches) return false;
    }
    return true;
  });
}
