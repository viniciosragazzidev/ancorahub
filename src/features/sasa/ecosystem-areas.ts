/**
 * Perguntas sobre todo o ecossistema do corretor (19/11): cada área é uma ferramenta de leitura tipada
 * (`ecosystem.ts`). Aqui, puro: quais áreas uma pergunta pede. Palavras óbvias resolvem sem IA; o resto a IA
 * escolhe numa lista fechada (nunca SQL livre).
 */
import { normalizePtBr } from "./parse-when";

export const SASA_AREAS = ["leads", "lead", "wallet", "duty", "agenda", "performance", "finance", "sales", "quotes", "notifications"] as const;
export type SasaArea = (typeof SASA_AREAS)[number];

export const SASA_AREA_LABEL: Record<SasaArea, string> = {
  leads: "Leads e etapas",
  lead: "Um lead",
  wallet: "Carteira e renovações",
  duty: "Plantões",
  agenda: "Agenda e retornos",
  performance: "Desempenho e metas",
  finance: "Comissões",
  sales: "Vendas",
  quotes: "Cotações e propostas",
  notifications: "Avisos",
};

/** Para o modelo escolher: o que cada ferramenta lê. */
export const SASA_AREA_GUIDE: Record<SasaArea, string> = {
  leads: "leads ativos do corretor, etapas, quem está esperando e há quanto tempo",
  lead: "um lead pelo nome: etapa, resumo da IA, histórico e notas",
  wallet: "carteira de clientes, clientes ativos, renovações e retornos de clientes",
  duty: "plantão de agora e próximos",
  agenda: "agenda, retornos e lembretes (atrasados, hoje, próximos)",
  performance: "números do dia, meta, ranking e tempo de aceite",
  finance: "comissões: a receber, recebido no mês, adiantamentos",
  sales: "vendas registradas, total e últimas vendas",
  quotes: "cotações e propostas feitas pelo corretor",
  notifications: "avisos e notificações recentes",
};

const RULES: Array<[SasaArea, RegExp]> = [
  ["finance", /\b(comiss\w*|financeiro|a receber|receb\w*|adiantament\w*|ganh\w*|pagamento|pago|paga)\b/],
  ["sales", /\b(venda|vendas|vendi|vendido|fechei|fechamentos?|contratos? fechados?)\b/],
  ["wallet", /\b(carteira|clientes?|renova\w*|ativos?)\b/],
  ["duty", /\b(plantao|plantoes|escala)\b/],
  ["agenda", /\b(agenda|retornos?|lembretes?|tarefas?|compromissos?)\b/],
  ["performance", /\b(meta|metas|ranking|desempenho|posicao|colocacao|taxa|aceite|como (estou|to|esta|ta) (indo|hoje|no mes))\b/],
  ["quotes", /\b(cotac\w*|propostas?|simulac\w*)\b/],
  ["notifications", /\b(avisos?|notificac\w*|recados?)\b/],
  ["leads", /\b(leads?|esperando|aguardando|etapas?|funil|negociac\w*|atendimentos?|novos?)\b/],
];

/** Áreas pedidas pelas palavras da pergunta (até 3), na ordem em que aparecem nas regras. */
export function areasOf(question: string): SasaArea[] {
  const text = normalizePtBr(question);
  const found = RULES.filter(([, pattern]) => pattern.test(text)).map(([area]) => area);
  return [...new Set(found)].slice(0, 3);
}

/** Pergunta ou pedido? Uma pergunta não executa nada: só lê. */
export function looksLikeQuestion(question: string) {
  const text = normalizePtBr(question).trim();
  return /\?$/.test(text) || /^(qual|quais|quanto|quantos|quantas|quando|quem|como|onde|o que|tenho|tem|existe|me (diz|fala|mostra|conta))\b/.test(text);
}
