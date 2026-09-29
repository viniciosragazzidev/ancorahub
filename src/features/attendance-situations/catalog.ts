/**
 * Atendimento → Situações: "when the customer says X, this happens". Pure,
 * no I/O, safe on the client.
 *
 * - builtin: situations the engine recognizes by itself. The tenant can teach
 *   extra phrases and switch off the optional ones; the critical ones (stop,
 *   wrong number, talk to a person) are always on.
 * - custom: the tenant's own situation, recognized by its phrases, with a
 *   fixed reply and an action (continue the qualification or transfer).
 * - guided: the "roteiros" — guidance the AI uses when the customer asks
 *   something no situation covers.
 *
 * A reply to a situation always leaves through the channel the customer
 * wrote to: answering from another number mid-conversation confuses them.
 */

export type SituationKind = "builtin" | "custom" | "guided";
export type SituationAction = "continue" | "transfer" | "pause" | "notify";

export const SITUATION_ACTION_LABEL: Record<SituationAction, string> = {
  continue: "Responde e segue a qualificação",
  transfer: "Transfere para um corretor",
  pause: "Para o atendimento automático",
  notify: "Responde e avisa o corretor",
};

export type BuiltinSituation = {
  /** Also the key of its reply text (ai_quick_reply_templates). */
  key: string;
  /** Quick-reply rule that recognizes it, when it is one. */
  ruleKey?: string;
  label: string;
  action: SituationAction;
  critical?: boolean;
  /** What the engine already recognizes, shown as examples. */
  examples: string[];
};

export const BUILTIN_SITUATIONS: readonly BuiltinSituation[] = [
  { key: "human.requested", ruleKey: "request_human", label: "Cliente pede para falar com uma pessoa", action: "transfer", critical: true, examples: ["falar com humano", "quero um corretor", "atendente"] },
  { key: "opt_out.confirmed", ruleKey: "opt_out", label: "Cliente pede para parar", action: "pause", critical: true, examples: ["sair", "não tenho interesse", "pare de enviar"] },
  { key: "wrong_number.confirmed", ruleKey: "wrong_number", label: "Número errado", action: "pause", critical: true, examples: ["número errado", "não sou eu", "engano"] },
  { key: "faq.price", label: "Pergunta sobre preço", action: "continue", examples: ["quanto custa?", "qual o valor?", "mensalidade"] },
  { key: "faq.operators", label: "Pergunta sobre operadoras", action: "continue", examples: ["trabalham com Amil?", "quais operadoras?", "Unimed"] },
  { key: "faq.waiting_period", label: "Pergunta sobre carência", action: "continue", examples: ["tem carência?"] },
  { key: "faq.who", label: "Pergunta quem está falando", action: "continue", examples: ["quem está falando?", "é robô?"] },
  { key: "urgent.requested", ruleKey: "urgent", label: "Cliente diz que é urgente", action: "notify", examples: ["urgente", "o quanto antes"] },
  { key: "callback.requested", ruleKey: "callback", label: "Cliente pede retorno por ligação", action: "notify", examples: ["me liga", "pode me ligar?"] },
];

export function builtinSituation(key: string) {
  return BUILTIN_SITUATIONS.find((situation) => situation.key === key) ?? null;
}

/** A tenant row: phrases taught for a builtin, or a custom situation. */
export type TenantSituation = {
  key: string;
  kind: "builtin" | "custom";
  title: string | null;
  examplePhrases: string[];
  response: string | null;
  action: "continue" | "transfer" | null;
  enabled: boolean;
};

export const MAX_SITUATION_PHRASES = 30;

/** Lowercase, no accents, no punctuation, single spaces. */
export function normalizeSituationText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Clean, deduplicated phrases a person typed (2+ characters, at most 30). */
export function cleanPhrases(phrases: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of phrases) {
    const phrase = raw.replace(/\s+/g, " ").trim().slice(0, 120);
    const key = normalizeSituationText(phrase);
    if (key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    result.push(phrase);
    if (result.length === MAX_SITUATION_PHRASES) break;
  }
  return result;
}

/** Whether the message contains one of the phrases as whole words. */
export function phraseMatches(message: string | null | undefined, phrases: readonly string[] | undefined) {
  if (!phrases?.length) return false;
  const text = ` ${normalizeSituationText(message)} `;
  if (text.trim().length === 0) return false;
  return phrases.some((phrase) => {
    const needle = normalizeSituationText(phrase);
    return needle.length >= 2 && text.includes(` ${needle} `);
  });
}

export type FaqSituation = "faq.price" | "faq.operators" | "faq.waiting_period" | "faq.who";

/**
 * Common questions asked in the middle of the qualification, answered with a
 * reviewed text before the pending question is asked again.
 */
export function matchFaqSituation(value: string | null | undefined): FaqSituation | null {
  const text = normalizeSituationText(value);
  if (!text) return null;
  if (/\b(carencia|carencias)\b/.test(text)) return "faq.waiting_period";
  if (/(quanto custa|quanto fica|quanto sai|fica quanto|sai quanto|qual (?:o |a )?(?:valor|preco|mensalidade)|quais (?:os )?(?:valores|precos)|\bvalores?\b|\bprecos?\b|\bmensalidade\b)/.test(text)) return "faq.price";
  if (/(\boperadoras?\b|\bamil\b|\bbradesco\b|sul ?america|\bunimed\b|\bhapvida\b|notre ?dame|porto seguro|\bprevent\b|golden cross|assim saude|\bleve saude\b)/.test(text)) return "faq.operators";
  if (/(quem (?:e|esta falando|fala|ta falando)|e (?:um )?robo|e (?:um )?bot|voce e (?:humano|robo|real|uma pessoa)|e golpe|isso e golpe)/.test(text)) return "faq.who";
  return null;
}

/** Phrases taught per quick-reply rule and the optional rules switched off, for the quick-reply resolver. */
export function quickReplyTuning(situations: readonly TenantSituation[]) {
  const phrases: Record<string, string[]> = {};
  const disabledRules: string[] = [];
  for (const builtin of BUILTIN_SITUATIONS) {
    if (!builtin.ruleKey) continue;
    const row = situations.find((item) => item.kind === "builtin" && item.key === builtin.key);
    if (!row) continue;
    if (!row.enabled && !builtin.critical) disabledRules.push(builtin.ruleKey);
    else if (row.examplePhrases.length) phrases[builtin.ruleKey] = row.examplePhrases;
  }
  return { phrases, disabledRules };
}

export type LateralSituation =
  | { kind: "faq"; key: FaqSituation; label: string }
  | { kind: "custom"; key: string; label: string; response: string; action: "continue" | "transfer" };

/**
 * A question in the middle of the qualification: the tenant's own situations
 * first (their phrases), then the system's common questions (taught phrases,
 * then the built-in recognition), respecting what is switched off.
 */
export function detectLateralSituation(message: string, situations: readonly TenantSituation[]): LateralSituation | null {
  for (const custom of situations) {
    if (custom.kind !== "custom" || !custom.enabled || !custom.response?.trim()) continue;
    if (phraseMatches(message, custom.examplePhrases)) {
      return { kind: "custom", key: custom.key, label: custom.title ?? "Situação", response: custom.response, action: custom.action ?? "continue" };
    }
  }
  const faqs = BUILTIN_SITUATIONS.filter((item) => item.key.startsWith("faq."));
  const rowOf = (key: string) => situations.find((item) => item.kind === "builtin" && item.key === key);
  for (const faq of faqs) {
    const row = rowOf(faq.key);
    if (row && !row.enabled) continue;
    if (row && phraseMatches(message, row.examplePhrases)) return { kind: "faq", key: faq.key as FaqSituation, label: faq.label };
  }
  const builtIn = matchFaqSituation(message);
  if (builtIn && rowOf(builtIn)?.enabled !== false) return { kind: "faq", key: builtIn, label: builtinSituation(builtIn)?.label ?? builtIn };
  return null;
}
