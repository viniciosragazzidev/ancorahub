/**
 * Message library (service engine phase 2): every message the system can say,
 * with its kind stated and where it is valid. Pure, no I/O.
 *
 * - Meta template: approved by Meta; the only thing Meta delivers outside the
 *   24-hour customer service window. Not used by the company number.
 * - Free message: plain text. On Meta only inside the 24-hour window (after
 *   the person wrote); through the company number (WAHA) at any time.
 * - AI quick reply: fixed answer the AI sends inside a conversation.
 */
export type MessageKind = "meta_template" | "free_message" | "quick_reply";

export type ChannelValidity = { channel: "meta" | "company_number"; label: string; valid: "always" | "window" | "never" };

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  meta_template: "Template Meta",
  free_message: "Mensagem livre",
  quick_reply: "Resposta rápida da IA",
};

export function channelValidity(kind: MessageKind): ChannelValidity[] {
  switch (kind) {
    case "meta_template":
      return [
        { channel: "meta", label: "Meta: a qualquer hora", valid: "always" },
        { channel: "company_number", label: "WhatsApp da empresa: não se aplica", valid: "never" },
      ];
    case "free_message":
      return [
        { channel: "meta", label: "Meta: só na janela de 24h", valid: "window" },
        { channel: "company_number", label: "WhatsApp da empresa: a qualquer hora", valid: "always" },
      ];
    case "quick_reply":
      return [
        { channel: "meta", label: "Meta: dentro da conversa", valid: "window" },
        { channel: "company_number", label: "WhatsApp da empresa: dentro da conversa", valid: "window" },
      ];
  }
}

/** The channel a use sends through: Meta official, the company number, or the one the customer wrote to. */
export type UsageChannel = "meta" | "company_number" | "conversation";

export const USAGE_CHANNEL_LABEL: Record<UsageChannel, string> = {
  meta: "Meta oficial",
  company_number: "WhatsApp da empresa",
  conversation: "Mesmo canal da conversa",
};

/** A place that uses a message; deleting or deactivating it changes what that place sends. */
export type MessageUsage = { area: "team_notice" | "situation" | "follow_up" | "ai"; label: string; channel?: UsageChannel };

export function describeUsages(usages: readonly MessageUsage[]) {
  return usages.map((usage) => usage.label).join(" · ");
}

/**
 * AI quick replies the engine actually sends, with the situation that
 * triggers each one. Only these are editable; the text may use {{nome}} and
 * {{resumo}} (what the customer already told).
 */
export const QUICK_REPLY_SITUATIONS: ReadonlyArray<{ ruleKey: string; label: string }> = [
  { ruleKey: "human.requested", label: "Cliente pede para falar com uma pessoa" },
  { ruleKey: "human.waiting_reminder", label: "Cliente escreve enquanto aguarda o corretor" },
  { ruleKey: "human.already_assigned", label: "Cliente escreve com o corretor já no atendimento" },
  { ruleKey: "faq.price", label: "Pergunta sobre preço" },
  { ruleKey: "faq.operators", label: "Pergunta sobre operadoras" },
  { ruleKey: "faq.waiting_period", label: "Pergunta sobre carência" },
  { ruleKey: "faq.who", label: "Pergunta quem está falando" },
  { ruleKey: "urgent.requested", label: "Cliente diz que é urgente" },
  { ruleKey: "callback.requested", label: "Cliente pede retorno por ligação" },
  { ruleKey: "media.received", label: "Cliente envia arquivo ou áudio" },
  { ruleKey: "opt_out.confirmed", label: "Cliente pede para parar" },
  { ruleKey: "wrong_number.confirmed", label: "Número errado" },
  { ruleKey: "thanks.confirmed", label: "Cliente agradece" },
  { ruleKey: "goodbye.confirmed", label: "Cliente se despede" },
  { ruleKey: "message.unclear", label: "Mensagem sem texto" },
];

export const QUICK_REPLY_VARIABLES: ReadonlyArray<{ key: string; label: string; example: string }> = [
  { key: "nome", label: "Primeiro nome do cliente", example: "Torquato" },
  { key: "resumo", label: "O que o cliente já contou", example: "individual, 40 anos e Itaboraí" },
];

/** Variables written as {{name}} in a text, in order of appearance. */
export function textVariables(text: string) {
  return [...new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]!))];
}

const PRICE_OR_PROMISE = /R\$|\breais\b|\d+[.,]\d{2}\b|\d+\s*%|\bcar[eê]ncia\b|\bgarant(o|imos|ido)\b|\bgr[aá]tis\b|\bdesconto\b/i;

/**
 * Keeps a suggested rewording only when it is safe to offer: same variables
 * as the original (none added or lost), no price, percentage, waiting period
 * or promise the original did not have, a sensible length, and different
 * from the original and from the other kept suggestions.
 */
export function acceptSuggestedVariations(original: string, suggestions: readonly string[], limit = 3) {
  const expected = textVariables(original).sort().join("|");
  const originalHasClaim = PRICE_OR_PROMISE.test(original);
  const seen = new Set([original.trim().toLowerCase()]);
  const kept: string[] = [];
  for (const raw of suggestions) {
    const text = raw.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/^["'“]+|["'”]+$/g, "").trim();
    if (!text || text.length < 8 || text.length > Math.max(original.length * 2, 400)) continue;
    if (textVariables(text).sort().join("|") !== expected) continue;
    if (!originalHasClaim && PRICE_OR_PROMISE.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(text);
    if (kept.length === limit) break;
  }
  return kept;
}
