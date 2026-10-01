import type { ConversationMemory } from "@/features/ai-agent/memory";

/**
 * Wording of the qualification replies. The engine decides WHAT to ask (field
 * order, skips, completion); this module only decides HOW to say it, from
 * reviewed phrasings. Pure, no I/O, no language model: every sentence a
 * customer can receive is written here or approved by the team.
 *
 * Rules:
 * - confirm what was understood, echoing the value ("Itaboraí, ótimo.");
 * - never open two consecutive messages the same way, never repeat the name
 *   in consecutive messages;
 * - the same seed always gives the same text (a retry keeps its wording);
 * - questions keep the keywords the extractor relies on to read short answers
 *   ("quantas pessoas/vidas", "idade/quantos anos", "cidade", "nome", "e-mail").
 */

export type QualificationFieldKey = "customerName" | "planType" | "numberOfLives" | "age" | "city" | "email";

export type ComposeQuestionInput = {
  key: QualificationFieldKey;
  memory: ConversationMemory;
  /** Fields the customer's last message filled (empty: nothing was answered). */
  answered: QualificationFieldKey[];
  /** The reply sent right before this one, to avoid repeating its opener and the name. */
  previousReply?: string | null;
  /** Stable per turn: conversation id + field + turn number. */
  seed: string;
  /** The question was already asked and not answered: rephrase it, no confirmation. */
  repeated?: boolean;
  /** This is the last missing field. */
  last?: boolean;
};

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function pick<T>(options: readonly T[], seed: string): T {
  return options[stableHash(seed) % options.length]!;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function firstWord(value: string | null | undefined) {
  return normalize(value).split(/[\s,.!?:]+/)[0] ?? "";
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function lives(memory: ConversationMemory) {
  const value = Number.parseInt(memory.numberOfLives?.value ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function ages(memory: ConversationMemory) {
  return (memory.age?.value ?? "").split(/[,\s]+/).map((item) => item.trim()).filter((item) => /^\d{1,3}$/.test(item));
}

function joinList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

const planLabel: Record<string, string> = { individual: "individual", familiar: "familiar", empresarial: "empresarial" };

/** Question wordings for a field, given what is already known. */
export function questionVariants(key: QualificationFieldKey, memory: ConversationMemory): string[] {
  const plan = memory.planType?.value;
  const count = lives(memory);
  switch (key) {
    case "customerName":
      return ["Qual é o seu nome completo?", "Como é o seu nome completo?"];
    case "planType":
      return [
        "Você busca um plano só para você, para a família ou para uma empresa (CNPJ)?",
        "O plano seria individual, familiar ou empresarial (CNPJ)?",
      ];
    case "numberOfLives":
      if (plan === "empresarial") return ["Quantas vidas vão entrar no plano, entre sócios, funcionários e dependentes?", "Quantas vidas a empresa quer incluir no plano, contando dependentes?"];
      if (plan === "familiar") return ["Quantas pessoas vão entrar no plano, contando com você?", "Contando com você, quantas pessoas vão entrar no plano?"];
      return ["Quantas pessoas vão entrar no plano?", "Quantas pessoas o plano vai incluir?"];
    case "age":
      if (plan === "empresarial") return ["Qual a média de idade das pessoas do plano?", "Qual a idade média do grupo que vai entrar no plano?"];
      // The plan may be for someone else (a grandchild, a parent): ask about who uses it.
      if (plan === "individual" || count === 1) return ["Qual a idade de quem vai usar o plano?", "Quantos anos tem quem vai usar o plano?"];
      if (count) return [`Quais as idades das ${count} pessoas?`, `Qual a idade de cada uma das ${count} pessoas?`];
      return ["Quais as idades das pessoas que vão entrar no plano?", "Qual a idade de cada pessoa que vai entrar no plano?"];
    case "city":
      return ["Em qual cidade você vai usar o plano?", "Qual a cidade onde você vai usar o plano?"];
    case "email":
      return ["Qual o seu melhor e-mail para eu enviar a cotação?", "Para qual e-mail posso mandar a cotação?"];
  }
}

/**
 * Short, human summary of what the customer told (never the e-mail):
 * "individual, 40 anos e Itaboraí". `only` limits it to some fields.
 */
export function summarizeQualification(memory: ConversationMemory, only?: readonly QualificationFieldKey[]) {
  const include = (key: QualificationFieldKey) => !only || only.includes(key);
  const parts: string[] = [];
  const plan = memory.planType?.value;
  if (include("planType") && plan && planLabel[plan]) parts.push(plan === "empresarial" ? "plano empresarial" : planLabel[plan]);
  const count = lives(memory);
  if (include("numberOfLives") && count && count > 1) parts.push(`${count} ${plan === "empresarial" ? "vidas" : "pessoas"}`);
  if (include("age")) {
    if (plan === "empresarial" && memory.averageAge?.value) parts.push(`média de ${memory.averageAge.value} anos`);
    else {
      const list = ages(memory);
      if (list.length === 1) parts.push(`${list[0]} anos`);
      else if (list.length > 1) parts.push(`idades ${joinList(list)}`);
    }
  }
  if (include("city") && memory.city?.value) parts.push(memory.city.value.trim());
  return joinList(parts);
}

type Ack = { text: string; usesName?: boolean };

/** Confirmations that echo the value of one field. */
function fieldAcks(key: QualificationFieldKey, memory: ConversationMemory, name: string | null): Ack[] {
  const named = (text: string): Ack[] => (name ? [{ text, usesName: true }] : []);
  switch (key) {
    case "customerName":
      return name ? [{ text: `Prazer, ${name}!`, usesName: true }, { text: `Obrigado, ${name}!`, usesName: true }] : [{ text: "Obrigado!" }];
    case "planType": {
      const plan = memory.planType?.value;
      if (plan === "individual") return [{ text: "Individual, anotado!" }, { text: "Plano individual, perfeito." }, ...named(`Certo, ${name}, só para você.`)];
      if (plan === "familiar") return [{ text: "Familiar, anotado!" }, { text: "Plano para a família, perfeito." }, ...named(`Perfeito, ${name}, plano familiar.`)];
      return [{ text: "Plano empresarial, anotado!" }, { text: "Para a empresa, perfeito." }, ...named(`Certo, ${name}, plano empresarial.`)];
    }
    case "numberOfLives": {
      const count = lives(memory);
      if (count === 1) return [{ text: "Só você, anotado." }, { text: "Uma pessoa, certo." }];
      const unit = memory.planType?.value === "empresarial" ? "vidas" : "pessoas";
      return [{ text: `${count} ${unit}, anotado.` }, { text: `Certo, ${count} ${unit}.` }, ...named(`Perfeito, ${name}, ${count} ${unit}.`)];
    }
    case "age": {
      if (memory.planType?.value === "empresarial" && memory.averageAge?.value) return [{ text: `Média de ${memory.averageAge.value} anos, anotado.` }, { text: "Idade média anotada." }];
      const list = ages(memory);
      if (list.length === 1) return [{ text: `${list[0]} anos, ok.` }, { text: `Anotado: ${list[0]} anos.` }, ...named(`Perfeito, ${name}.`)];
      return [{ text: "Idades anotadas." }, { text: "Perfeito, anotei as idades." }];
    }
    case "city": {
      const city = memory.city?.value?.trim() ?? "";
      return [{ text: `${city}, ótimo.` }, { text: `Anotado: ${city}.` }, ...named(`Perfeito, ${name}.`)];
    }
    case "email":
      return [{ text: "E-mail anotado." }, { text: "Anotei seu e-mail." }];
  }
}

function acknowledgement(input: ComposeQuestionInput, name: string | null): string {
  if (input.repeated || !input.answered.length) return "";
  const nameRecentlyUsed = Boolean(name && normalize(input.previousReply).includes(normalize(name)));
  const previousOpener = firstWord(input.previousReply);
  if (input.answered.length > 1) {
    const summary = summarizeQualification(input.memory, input.answered);
    if (summary) {
      const options = [`Anotei: ${summary}.`, `Perfeito, anotei: ${summary}.`];
      const fresh = options.filter((text) => firstWord(text) !== previousOpener);
      return pick(fresh.length ? fresh : options, `${input.seed}:ack`);
    }
  }
  const candidates = fieldAcks(input.answered[0]!, input.memory, name)
    .filter((ack) => !(ack.usesName && nameRecentlyUsed))
    .filter((ack) => firstWord(ack.text) !== previousOpener);
  const pool = candidates.length ? candidates : fieldAcks(input.answered[0]!, input.memory, null);
  return pick(pool, `${input.seed}:ack`).text;
}

/** One qualification question with its confirmation, progress cue and rephrasing. */
export function composeQuestionReply(input: ComposeQuestionInput): string {
  const name = input.memory.customerFirstName?.value?.trim() || input.memory.customerName?.value?.trim().split(/\s+/)[0] || null;
  const variants = questionVariants(input.key, input.memory);
  const question = pick(variants, `${input.seed}:q`);
  if (input.repeated) {
    const lead = pick(["Só para eu registrar certinho:", "Para eu seguir com a cotação:", "Me ajuda com uma informação:"], `${input.seed}:r`);
    return `${lead} ${lowerFirst(question)}`;
  }
  const ack = acknowledgement(input, name);
  const body = input.last ? `Última pergunta: ${lowerFirst(question)}` : question;
  return ack ? `${ack} ${body}` : body;
}

/** True when any wording of this question (current or legacy) was already sent. */
export function wasQuestionAsked(key: QualificationFieldKey, memory: ConversationMemory, legacyText: string, pastOutboundTexts: Iterable<string>) {
  const needles = [legacyText, ...questionVariants(key, memory)].map((text) => normalize(text));
  for (const sent of pastOutboundTexts) {
    const haystack = normalize(sent);
    if (needles.some((needle) => haystack.includes(needle) || haystack.includes(lowerFirst(needle)))) return true;
  }
  return false;
}

/**
 * Renders the variables of a handoff/quick reply text: {{nome}} and {{resumo}}.
 * An empty variable takes its surrounding punctuation with it, so
 * "Claro, {{nome}}! ... ({{resumo}})." never becomes "Claro, ! ... ().".
 */
export function renderConversationVariables(text: string, memory: ConversationMemory, fallbackName?: string | null) {
  const usableFallback = fallbackName && !/^lead whatsapp/i.test(fallbackName.trim()) ? fallbackName.trim().split(/\s+/)[0] : "";
  const name = memory.customerFirstName?.value?.trim() || memory.customerName?.value?.trim().split(/\s+/)[0] || usableFallback || "";
  const summary = summarizeQualification(memory);
  let result = text;
  if (!name) result = result.replace(/,?\s*\{\{\s*nome\s*\}\}/gi, "");
  if (!summary) result = result.replace(/\s*\(\s*\{\{\s*resumo\s*\}\}\s*\)/gi, "").replace(/[,:]?\s*\{\{\s*resumo\s*\}\}/gi, "");
  return result
    .replace(/\{\{\s*nome\s*\}\}/gi, name)
    .replace(/\{\{\s*resumo\s*\}\}/gi, summary)
    .replace(/\s+([!?.,])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Default text when a customer asks for a person, and when the qualification is complete. */
export const DEFAULT_HUMAN_REQUEST_TEXT = "Claro, {{nome}}! Já passei seu atendimento para um corretor especialista com o que você me contou ({{resumo}}). Ele continua a conversa por aqui em instantes.";
export const DEFAULT_QUALIFIED_HANDOFF_TEXT = "Obrigado, {{nome}}! Com essas informações ({{resumo}}), já passei seu atendimento para um corretor especialista. Ele continua a conversa por aqui em instantes.";

/**
 * Former default handoff texts, saved on tenants without being customized.
 * They give way to the current default (with name and summary); a text the
 * tenant actually wrote is kept.
 */
const RETIRED_HANDOFF_TEXTS = new Set([
  "Vou encaminhar você para um corretor da equipe agora.",
  "Obrigado pelas informações. Vou encaminhar seu atendimento para um corretor da equipe agora.",
]);

export function effectiveHandoffText(configured: string | null | undefined, fallback: string) {
  const text = configured?.trim();
  return text && !RETIRED_HANDOFF_TEXTS.has(text) ? text : fallback;
}
