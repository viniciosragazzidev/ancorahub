export const LEAD_STATUS_ORDER: Record<string, number> = {
  new: 0,
  distributed: 1,
  in_contact: 2,
  quote_sent: 3,
  negotiation: 4,
  documentation_pending: 5,
  under_analysis: 6,
  converted: 7,
  lost: 8,
};

/** Mapa de transições válidas entre status do pipeline.
 *  Cada chave lista os status para os quais é possível avançar.
 *  "lost" pode surgir de qualquer status ativo.
 *  Ao reabrir de "lost", pode voltar para qualquer status ativo. */
export const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  new: ["distributed", "lost"],
  distributed: ["in_contact", "new", "lost"],
  in_contact: ["quote_sent", "lost"],
  quote_sent: ["negotiation", "lost"],
  negotiation: ["documentation_pending", "lost"],
  documentation_pending: ["under_analysis", "lost"],
  under_analysis: ["converted", "lost"],
  converted: [],
  lost: ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"],
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  distributed: "Distribuído",
  in_contact: "Em Atendimento",
  quote_sent: "Cotação Enviada",
  negotiation: "Negociação",
  documentation_pending: "Documentação Pendente",
  under_analysis: "Em Análise",
  converted: "Convertido",
  lost: "Perdido",
};

export const MOTIVOS_PERDA = [
  "preco",
  "carência",
  "encontrou_mais_barato",
  "desistiu",
  "problema_saude",
  "nao_qualificado",
  "outro",
] as const;

export type MotivoPerda = (typeof MOTIVOS_PERDA)[number];

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  preco: "Preço acima do esperado",
  carência: "Período de carência incompatível",
  encontrou_mais_barato: "Encontrou opção mais barata",
  desistiu: "Desistiu da contratação",
  problema_saude: "Problema de saúde não coberto",
  nao_qualificado: "Lead não qualificado",
  outro: "Outro motivo",
};
