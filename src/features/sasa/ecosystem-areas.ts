/**
 * Perguntas sobre todo o ecossistema do corretor (19/11): cada área é uma ferramenta de leitura tipada
 * (`ecosystem.ts`). Aqui, puro: quais áreas uma pergunta pede. Palavras óbvias resolvem sem IA; o resto a IA
 * escolhe numa lista fechada (nunca SQL livre).
 */
import { normalizePtBr } from "./parse-when";

export const SASA_AREAS = ["leads", "lead", "wallet", "duty", "agenda", "performance", "finance", "sales", "quotes", "notifications", "account"] as const;
export type SasaArea = (typeof SASA_AREAS)[number];

export const SASA_AREA_LABEL: Record<SasaArea, string> = {
  leads: "Leads e fila",
  lead: "Um lead",
  wallet: "Carteira e renovações",
  duty: "Plantões",
  agenda: "Agenda e retornos",
  performance: "Desempenho e metas",
  finance: "Comissões",
  sales: "Vendas",
  quotes: "Cotações e propostas",
  notifications: "Avisos",
  account: "Conta e WhatsApp",
};

/** Para o modelo escolher: o que cada ferramenta lê. */
export const SASA_AREA_GUIDE: Record<SasaArea, string> = {
  leads: "leads ativos do corretor, novos, etapas, quem está esperando e há quanto tempo",
  lead: "um lead pelo nome: etapa, última conversa, notas, próximo passo",
  wallet: "carteira de clientes, clientes ativos, renovações em 90 dias, aniversários de contrato",
  duty: "plantão de agora, próximo, escala da semana, presença confirmada",
  agenda: "agenda e retornos de hoje, atrasados e da semana",
  performance: "taxa de aceite, tempo de primeira resposta, meta do mês e quanto falta, ranking",
  finance: "comissões: a receber, recebido no mês, previsto nos próximos meses, adiantamentos",
  sales: "vendas registradas: do mês em quantidade e valor, últimas vendas",
  quotes: "cotações e propostas feitas pelo corretor: enviadas e pendentes",
  notifications: "avisos e notificações recentes",
  account: "WhatsApp conectado ou não, disponibilidade (recebendo ou pausado)",
};

const RULES: Array<[SasaArea, RegExp]> = [
  ["finance", /\b(comiss\w*|financeiro|a receber|receb(i|ido|ida|eu|er|o)|vou receber|adiantament\w*|ganh\w*|pagamento|previst\w*|previsao)\b/],
  ["sales", /\b(venda|vendas|vendi|vendido|fechei|fechamentos?|contratos? fechados?)\b/],
  ["wallet", /\b(carteira|clientes?|renova\w*|aniversari\w*)\b/],
  ["duty", /\b(plantao|plantoes|escala|confirmad\w*|presenca)\b/],
  ["agenda", /\b(agenda|retornos?|lembretes?|tarefas?|compromissos?)\b/],
  ["performance", /\b(meta|metas|ranking|desempenho|posicao|colocacao|taxa|aceite|conversao|primeira resposta|tempo de resposta|como (estou|to|esta|ta) (indo|hoje|no mes))\b/],
  ["quotes", /\b(cotac\w*|propostas?|simulac\w*)\b/],
  ["notifications", /\b(avisos?|notificac\w*|recados?|de novo)\b/],
  ["account", /\b(whatsapp|zap|conectad\w*|desconectad\w*|disponivel|disponibilidade|pausad\w*|recebendo)\b/],
  ["leads", /\b(leads?|esperando|aguardando|etapas?|funil|negociac\w*|atendimentos?)\b/],
];

/** Áreas pedidas pelas palavras da pergunta (até 3), na ordem em que aparecem nas regras. */
export function areasOf(question: string): SasaArea[] {
  const text = normalizePtBr(question);
  const found = RULES.filter(([, pattern]) => pattern.test(text)).map(([area]) => area);
  return [...new Set(found)].slice(0, 3);
}

/**
 * Pede análise, não um número: "qual lead devo priorizar?", "resume o Carlos", "compara com a semana passada".
 * Essas vão para a IA limitada, que combina leituras; as diretas não saberiam responder.
 */
export function wantsAnalysis(question: string) {
  return /\b(prioriz\w*|devo|deveria|compar\w*|resum\w*|analis\w*|por que|porque|sugest\w*|dica|estrategia|melhor|pior|tendencia|evolu\w*)\b/.test(normalizePtBr(question));
}

/** Pergunta ou pedido? Uma pergunta não executa nada: só lê. */
export function looksLikeQuestion(question: string) {
  const text = normalizePtBr(question).trim();
  return /\?$/.test(text) || /^(qual|quais|quanto|quantos|quantas|quando|quem|como|onde|o que|tenho|tem|existe|estou|to|me (diz|fala|mostra|conta)|resume|resuma)\b/.test(text);
}
