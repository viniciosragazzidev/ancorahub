/**
 * Messages that were not written by the person: the customer's own WhatsApp
 * Business auto-reply, a menu bot, or a copied instruction ("Digite sua idade
 * por favor."). They are not answers: the qualification must not read facts
 * from them, and the reply must not pretend the person said something.
 * Pure, no I/O.
 */

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const AUTOMATED_PATTERNS: RegExp[] = [
  // Menu / form instructions addressed to whoever is on the other side.
  /^(?:por favor,?\s+)?(?:digite|selecione|tecle|pressione|aperte|clique|toque)\b/,
  /^(?:por favor,?\s+)?(?:escolha|responda com|envie o numero|informe o numero) (?:uma |a )?(?:opcao|numero)/,
  /^[^.!?]{0,60}[.!?:]\s*digite (?:o numero|a opcao|uma opcao|\d)/,
  // Business auto-replies.
  /\b(?:mensagem|resposta|atendimento) automatic[ao]\b/,
  /\bno momento (?:nao|nao estamos|estamos (?:ausentes|indisponiveis))\b.*\b(?:atender|disponive|responder)/,
  /\bfora do (?:nosso )?horario de atendimento\b/,
  /^(?:(?:ola|oi|bom dia|boa tarde|boa noite)[!,.\s]*)?(?:obrigad[oa]|agradecemos) (?:por entrar em contato|pelo (?:seu )?contato|pela (?:sua )?mensagem)\b/,
  /\bem breve (?:retornaremos|responderemos|entraremos|daremos retorno|um de nossos|um atendente)\b/,
  /\bseja bem[- ]?vind[oa] (?:a|ao|à)\b/,
  /\bnosso horario de (?:atendimento|funcionamento)\b/,
  /^(?:ola|oi|bom dia|boa tarde|boa noite)?[!,.\s]*como (?:posso|podemos) (?:te |lhe )?ajudar\??$/,
];

/**
 * The person talking about themselves ("tenho 4 vidas", "sou MEI", "quero para mim"): a real
 * answer even when it also carries a courtesy ("Obrigado pelo contato, tenho 4 vidas").
 */
const PERSONAL_PATTERN = /\b(?:tenho|temos|sou|somos|quero|queremos|preciso|precisamos|eu|minha|meu|minhas|meus|vidas?|anos)\b/;

/** Menus: "1 - Vendas 2 - Suporte" / "1) ... 2) ...". */
const MENU_PATTERN = /(?:^|\s)1\s*[-).]\s*\S+[\s\S]*(?:^|\s)2\s*[-).]\s*\S+/;

export function isAutomatedInboundMessage(message: string | null | undefined): boolean {
  const text = normalize(message ?? "");
  if (!text || text.length > 600) return false;
  if (MENU_PATTERN.test(text) && /\b(?:opc|digite|escolha|selecione|menu)/.test(text)) return true;
  if (PERSONAL_PATTERN.test(text)) return false;
  return AUTOMATED_PATTERNS.some((pattern) => pattern.test(text));
}
