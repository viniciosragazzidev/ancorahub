import type { ConversationMemory } from "@/features/ai-agent/memory";

export const LEAD_QUALIFICATION_STATUSES = [
  "pending",
  "qualified",
  "hot",
  "warm",
  "cold",
] as const;

export type LeadQualificationStatus = (typeof LEAD_QUALIFICATION_STATUSES)[number];

export const LEAD_QUALIFICATION_LABELS: Record<LeadQualificationStatus, string> = {
  pending: "Pendente",
  qualified: "Qualificado",
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

/** Classifies only from explicit conversation signals; absence of a signal stays qualified. */
export function deriveLeadQualificationStatus(memory: ConversationMemory): LeadQualificationStatus {
  const intent = memory.intent?.value.toLowerCase() ?? "";
  if (/(sem interesse|desisti|não quero|nao quero|só pesquis|so pesquis)/i.test(intent)) return "cold";
  if (/(contratar|fechar|cotaç|cotac|preço|preco|urgente|agora)/i.test(intent)) return "hot";
  if (memory.planType?.value === "familiar" || memory.planType?.value === "empresarial") return "warm";
  return "qualified";
}
