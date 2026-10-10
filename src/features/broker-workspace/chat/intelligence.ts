/** AI reading of a lead's WhatsApp conversation, saved in leads.qualification_details.aiIntelligence. */
export type LeadIntelligence = {
  summary: string | null;
  nextBestAction: string | null;
  /** Who owes the next message: BROKER, CUSTOMER, INTERNAL or NONE. */
  pendingFrom: string | null;
  sentiment: string | null;
  customerIntent: string | null;
  risk: string | null;
  lastAnalyzedAt: string | null;
  conversationStage?: string | null;
  engagement?: string | null;
  opportunity?: string | null;
  objections?: string[];
  buyingSignals?: string[];
};

export function readLeadIntelligence(value: unknown): LeadIntelligence {
  const details = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const assessment = details.aiIntelligence && typeof details.aiIntelligence === "object"
    ? details.aiIntelligence as Record<string, unknown>
    : {};
  const read = (key: string) => typeof assessment[key] === "string" && assessment[key] ? assessment[key] as string : null;
  const list = (key: string) => Array.isArray(assessment[key])
    ? (assessment[key] as unknown[]).filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  return {
    summary: read("summary"),
    nextBestAction: read("nextBestAction"),
    pendingFrom: read("pendingFrom"),
    sentiment: read("sentiment"),
    customerIntent: read("customerIntent"),
    risk: read("risk"),
    lastAnalyzedAt: typeof details.aiLastAnalyzedAt === "string" ? details.aiLastAnalyzedAt : null,
    conversationStage: read("conversationStage"),
    engagement: read("engagement"),
    opportunity: read("opportunity"),
    objections: list("objections"),
    buyingSignals: list("buyingSignals"),
  };
}

export function isOutboundMessage(direction: string) {
  return direction === "outgoing" || direction === "outbound";
}

const STAGE_LABEL: Record<string, string> = {
  INITIAL_CONTACT: "Primeiro contato",
  DISCOVERY: "Entendendo a necessidade",
  QUALIFICATION: "Qualificação",
  QUOTE_PREPARATION: "Preparando cotação",
  QUOTE_PRESENTED: "Cotação apresentada",
  NEGOTIATION: "Negociação",
  DOCUMENT_COLLECTION: "Documentos",
  ANALYSIS: "Em análise",
  CLOSING: "Fechamento",
  POST_SALE: "Pós-venda",
};
const INTENT_LABEL: Record<string, string> = { VERY_HIGH: "Muito alta", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa", NONE: "Nenhuma" };
const SENTIMENT_LABEL: Record<string, string> = { POSITIVE: "Positivo", NEUTRAL: "Neutro", NEGATIVE: "Negativo" };
const ENGAGEMENT_LABEL: Record<string, string> = { HIGH: "Alto", MEDIUM: "Médio", LOW: "Baixo" };
const PENDING_LABEL: Record<string, string> = { BROKER: "Você", CUSTOMER: "O cliente", INTERNAL: "Equipe interna", NONE: "Ninguém" };

export const intelligenceLabel = {
  stage: (value?: string | null) => (value ? STAGE_LABEL[value] ?? null : null),
  intent: (value?: string | null) => (value ? INTENT_LABEL[value] ?? null : null),
  sentiment: (value?: string | null) => (value ? SENTIMENT_LABEL[value] ?? null : null),
  engagement: (value?: string | null) => (value ? ENGAGEMENT_LABEL[value] ?? null : null),
  pending: (value?: string | null) => (value ? PENDING_LABEL[value] ?? null : null),
};

/** The AI's next step in plain Portuguese; codes like SEND_REVISED_QUOTE become readable text. */
export function nextStepText(value?: string | null) {
  if (!value) return null;
  const known: Record<string, string> = {
    SEND_REVISED_QUOTE: "Mandar uma cotação revisada",
    SEND_QUOTE: "Mandar a cotação",
    FOLLOW_UP: "Fazer um acompanhamento",
    SCHEDULE_CALL: "Marcar uma ligação",
    REQUEST_DOCUMENTS: "Pedir os documentos",
    ANSWER_QUESTION: "Responder a dúvida do cliente",
    CLOSE_SALE: "Fechar a venda",
    NONE: "",
  };
  if (value in known) return known[value] || null;
  if (/^[A-Z0-9_]+$/.test(value)) {
    const text = value.toLowerCase().replace(/_/g, " ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return value;
}

/** Short, practical tips derived from the analysis (2 to 4, most important first). */
export function intelligenceTips(input: Partial<LeadIntelligence>): string[] {
  const tips: string[] = [];
  if (input.pendingFrom === "BROKER") tips.push("Ele está esperando você. Responda ainda hoje: cada hora a mais esfria o lead.");
  if (input.sentiment === "NEGATIVE") tips.push("O tom está negativo. Comece reconhecendo o incômodo antes de falar de plano ou preço.");
  const objection = input.objections?.[0];
  if (objection) tips.push(`Trate primeiro a objeção principal: ${objection}.`);
  if (input.customerIntent === "VERY_HIGH" || input.customerIntent === "HIGH") tips.push("Intenção alta: proponha um passo concreto (cotação ou fechamento) na mesma mensagem.");
  else if (input.customerIntent === "LOW" || input.customerIntent === "NONE") tips.push("Intenção baixa: faça uma pergunta aberta sobre o que ele precisa antes de mandar preço.");
  if (input.conversationStage === "QUOTE_PRESENTED") tips.push("A cotação já foi apresentada: pergunte o que achou e se ficou dúvida de rede ou carência.");
  if (input.engagement === "LOW") tips.push("Ele responde pouco: mensagens curtas, com uma pergunta só, funcionam melhor.");
  if (input.pendingFrom === "CUSTOMER") tips.push("A resposta está com ele. Se não voltar em 1 dia, mande um lembrete curto.");
  return tips.slice(0, 4);
}
