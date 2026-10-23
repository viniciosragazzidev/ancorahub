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
  /** The director's own wording for this question (Atendimento > Fluxo); replaces the built-in ones. */
  customText?: string | null;
  /** Also ask whether the customer already has a plan (last question, asked once). */
  askCurrentPlan?: boolean;
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
    // WhatsApp tone (Vinicios, 23/10): short, warm, "pra" and "tá", like a person writes.
    case "customerName":
      return ["Pra eu te atender direitinho, qual é o seu nome completo?", "Me diz seu nome completo, por favor?"];
    case "planType":
      return [
        "Me conta: o plano seria só pra você, pra sua família ou pra sua empresa (CNPJ)?",
        "Você tá pensando num plano só seu, pra família ou pela empresa (CNPJ)?",
        "O plano seria pra você, pra família ou pra empresa (CNPJ)?",
      ];
    case "numberOfLives":
      if (plan === "empresarial") return ["Quantas vidas a empresa quer colocar no plano, contando sócios, funcionários e dependentes?", "E quantas vidas entram no plano da empresa, contando os dependentes?"];
      if (plan === "familiar") return ["Contando com você, quantas pessoas vão entrar no plano?", "E quantas pessoas da família vão entrar, contando com você?"];
      return ["Quantas pessoas vão entrar no plano?", "E o plano seria pra quantas pessoas?"];
    case "age":
      if (plan === "empresarial") return ["E qual é mais ou menos a média de idade do pessoal?", "Qual seria a idade média do grupo que vai entrar no plano?"];
      // The plan may be for someone else (a grandchild, a parent): ask about who uses it.
      if (plan === "individual" || count === 1) return ["E qual a idade de quem vai usar o plano?", "Quantos anos tem quem vai usar o plano?"];
      if (count) return [`E quais as idades das ${count} pessoas? Pode mandar só os números, tipo 35 e 32.`, `Me passa a idade de cada uma das ${count} pessoas?`];
      return ["E quais as idades de quem vai entrar no plano?", "Me passa a idade de cada pessoa que vai entrar no plano?"];
    case "city":
      return [
        "Em qual cidade e bairro você mora? Assim já busco opções com hospitais pertinho de você.",
        "Me conta sua cidade e bairro, que eu procuro opções com rede perto de você.",
      ];
    case "email":
      return ["Qual o seu melhor e-mail pra eu te mandar a cotação?", "Pra qual e-mail posso te mandar a cotação?"];
  }
}

/**
 * "Já têm plano de saúde hoje?", asked once in the same message as the last question
 * (23/10). A separate final question the customer never answers would leave a qualified
 * lead without a broker, so the answer is optional and the flow never waits for it.
 * Every wording carries CURRENT_PLAN_MARKER ("plano de saúde hoje", ai-agent/memory.ts).
 */
export function currentPlanQuestion(memory: ConversationMemory, seed: string) {
  const count = lives(memory);
  const plural = (count ?? 1) > 1 || memory.planType?.value === "familiar" || memory.planType?.value === "empresarial";
  return pick(plural
    ? ["E vocês já têm plano de saúde hoje? Se tiver, me conta qual, que eu comparo pra vocês.", "Ah, e vocês já têm algum plano de saúde hoje? Se sim, qual?"]
    : ["E você já tem plano de saúde hoje? Se tiver, me conta qual, que eu comparo pra você.", "Ah, e você já tem algum plano de saúde hoje? Se sim, qual?"], `${seed}:current-plan`);
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
      return name ? [{ text: `Prazer, ${name}!`, usesName: true }, { text: `Que bom falar com você, ${name}!`, usesName: true }] : [{ text: "Obrigado!" }];
    case "planType": {
      const plan = memory.planType?.value;
      if (plan === "individual") return [{ text: "Só pra você, entendi!" }, { text: "Plano individual, combinado." }, ...named(`Beleza, ${name}, só pra você.`)];
      if (plan === "familiar") return [{ text: "Pra família, que ótimo!" }, { text: "Plano familiar, combinado." }, ...named(`Perfeito, ${name}, pra família.`)];
      return [{ text: "Pela empresa, ótimo!" }, { text: "Plano empresarial, combinado." }, ...named(`Beleza, ${name}, pela empresa.`)];
    }
    case "numberOfLives": {
      const count = lives(memory);
      if (count === 1 && memory.planType?.value === "empresarial") return [{ text: "1 vida, anotado!" }, { text: "Beleza, 1 vida." }];
      if (count === 1) return [{ text: "Só você, beleza!" }, { text: "Uma pessoa, entendi." }];
      const unit = memory.planType?.value === "empresarial" ? "vidas" : "pessoas";
      return [{ text: `${count} ${unit}, anotado!` }, { text: `Beleza, ${count} ${unit}.` }, ...named(`Perfeito, ${name}, ${count} ${unit}.`)];
    }
    case "age": {
      if (memory.planType?.value === "empresarial" && memory.averageAge?.value) return [{ text: `Média de ${memory.averageAge.value} anos, anotado!` }, { text: "Beleza, anotei a idade média." }];
      const list = ages(memory);
      if (list.length === 1) return [{ text: `${list[0]} anos, anotado!` }, { text: `Beleza, ${list[0]} anos.` }, ...named(`Perfeito, ${name}.`)];
      return [{ text: "Perfeito, anotei as idades!" }, { text: "Ótimo, idades anotadas." }];
    }
    case "city": {
      const city = memory.city?.value?.trim() ?? "";
      const place = memory.neighborhood?.value ? `${memory.neighborhood.value.trim()}, ${city}` : city;
      return [{ text: `${place}, ótimo!` }, { text: `Anotado: ${place}.` }, ...named(`Perfeito, ${name}.`)];
    }
    case "email":
      return [{ text: "E-mail anotado!" }, { text: "Anotei seu e-mail, obrigado!" }];
  }
}

function acknowledgement(input: ComposeQuestionInput, name: string | null): string {
  if (input.repeated || !input.answered.length) return "";
  const nameRecentlyUsed = Boolean(name && normalize(input.previousReply).includes(normalize(name)));
  const previousOpener = firstWord(input.previousReply);
  if (input.answered.length > 1) {
    const summary = summarizeQualification(input.memory, input.answered);
    if (summary) {
      const options = [`Anotei aqui: ${summary}.`, `Perfeito, anotei: ${summary}.`];
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
  const custom = input.customText?.trim();
  const variants = custom ? [custom] : questionVariants(input.key, input.memory);
  const question = pick(variants, `${input.seed}:q`);
  if (input.repeated) {
    const lead = pick(["Só pra eu anotar certinho:", "Pra eu seguir com a cotação:", "Me ajuda só com uma coisa:"], `${input.seed}:r`);
    return `${lead} ${lowerFirst(question)}`;
  }
  const ack = acknowledgement(input, name);
  const asked = input.last ? `Pra fechar: ${lowerFirst(question)}` : question;
  // Same paragraph as the last question, so the next answer is read against both.
  const body = input.askCurrentPlan ? `${asked} ${currentPlanQuestion(input.memory, input.seed)}` : asked;
  return ack ? `${ack} ${body}` : body;
}

/** A first name fit to greet with: not a placeholder such as "Lead WhatsApp 55..." or "Cliente". */
export function greetingName(value: string | null | undefined) {
  const first = (value ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first || /^lead$/i.test(first) || /cliente/i.test(first) || /\d/.test(first) || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Opening of the first reply the AI sends in a conversation: greets the
 * person by name and says who is talking ("Oi, Neuza! Me chamo Ana e falo da
 * Âncora Saúde."). The qualification question follows it in the same message.
 * A generic assistant name ("Assistente Âncora Corretora") is not used as a
 * person's name.
 */
export function composeGreeting(input: { name?: string | null; assistantName?: string | null; companyName?: string | null; seed: string }) {
  const name = greetingName(input.name);
  const company = input.companyName?.trim() || "Âncora Saúde";
  const assistant = input.assistantName?.trim();
  const personal = assistant && !/^assistente\b/i.test(assistant) && assistant.split(/\s+/).length <= 3 ? assistant : null;
  const who = personal ? `Me chamo ${personal} e falo da ${company}` : `Aqui é da ${company}`;
  const hello = name ? [`Oi, ${name}!`, `Olá, ${name}, tudo bem?`, `Oi, ${name}, tudo bem?`] : ["Oi!", "Olá, tudo bem?", "Oi, tudo bem?"];
  const close = ["Vou te ajudar com a cotação do seu plano de saúde.", "Vou cuidar da sua cotação de plano de saúde.", "Já te ajudo com o plano de saúde."];
  return `${pick(hello, `${input.seed}:hello`)} ${who}. ${pick(close, `${input.seed}:close`)}`;
}

/** True when any wording of this question (current or legacy) was already sent. */
export function wasQuestionAsked(key: QualificationFieldKey, memory: ConversationMemory, legacyText: string, pastOutboundTexts: Iterable<string>, customText?: string | null) {
  const needles = [legacyText, ...questionVariants(key, memory), ...(customText?.trim() ? [customText.trim()] : [])].map((text) => normalize(text));
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
 * Between 19h and 9h (São Paulo) no broker answers "em instantes": the brokers start at
 * 9h, so the closing says the first available broker gets in touch as soon as possible
 * (Vinicios, 21/10). Used instead of the configured text at night.
 */
export const AFTER_HOURS_QUALIFIED_HANDOFF_TEXT = "Obrigado, {{nome}}! Com essas informações ({{resumo}}), seu atendimento já está com a nossa equipe. O mais breve possível, o primeiro corretor disponível entra em contato com você por aqui.";
export const AFTER_HOURS_HUMAN_REQUEST_TEXT = "Claro, {{nome}}! Já passei seu atendimento para a nossa equipe com o que você me contou ({{resumo}}). O mais breve possível, o primeiro corretor disponível continua a conversa por aqui.";
export const AFTER_HOURS_START_HOUR = 19;
export const AFTER_HOURS_END_HOUR = 9;

export function isAfterHoursInSaoPaulo(now: Date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= AFTER_HOURS_START_HOUR || hour < AFTER_HOURS_END_HOUR;
}

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

/**
 * The customer says the current plan costs too much ("o preço está alto demais", "quero
 * reduzir"): one line that shows it was heard before the next question (case Maria Tereza,
 * 23/10: the reply skipped straight to "individual ou empresa?"). Null otherwise.
 */
export function priceConcernLine(message: string, input: { lives: number | null; seed: string }) {
  const text = normalize(message);
  const concern = /\b(reducao|reduzir|baixar|diminuir|economi\w*|mais barat\w*|mais em conta|caro|cara|alto demais|muito alto|muito alta|pesad\w*|nao (?:consigo|da) (?:mais )?pagar|nao cabe)\b/.test(text);
  const aboutPrice = /\b(preco|valor|mensalidade|pago|pagando|plano|boleto|custo)\b/.test(text);
  if (!concern || !aboutPrice) return null;
  const you = (input.lives ?? 1) > 1 ? "vocês" : "você";
  return pick([
    `Entendi, o valor de hoje está pesando. Vou te ajudar a encontrar uma opção que caiba melhor no orçamento de ${you}.`,
    `Entendi, a ideia é pagar menos sem perder um bom atendimento. Vamos buscar as melhores opções para ${you}.`,
    `Faz sentido querer reduzir esse valor. Vou montar opções mais em conta para ${you}.`,
  ], `${input.seed}:price`);
}
