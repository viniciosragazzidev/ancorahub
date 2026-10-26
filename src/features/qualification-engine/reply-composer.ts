import { beneficiariesFromMemory, parseAgeValues } from "@/features/ai-agent/beneficiary-relations";
import type { ConversationMemory } from "@/features/ai-agent/memory";
import { brokerAvailability } from "./broker-window";

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
  /** The three newest replies, newest first, used to avoid repeating a recent opener. */
  recentReplies?: readonly string[];
  /** Full opening line with the sender and company, only for the first reply. */
  greetingText?: string | null;
  /** Add a period greeting after the opening or a six-hour quiet interval. */
  periodGreeting?: boolean;
  /** Stable clock input for deterministic greeting selection. */
  now?: Date;
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

function firstSentence(value: string) {
  const ending = /[.!?](?=\s|$)/.exec(value);
  return ending?.index === undefined ? value : value.slice(0, ending.index + 1);
}

function firstQuestionSentence(value: string) {
  const questionEnd = value.indexOf("?");
  return questionEnd < 0 ? firstSentence(value) : value.slice(0, questionEnd + 1);
}

export function greetingForHour(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

const GREETING_SILENCE_MS = 6 * 60 * 60 * 1000;

export function shouldUsePeriodGreeting(lastOutboundAt: Date | null | undefined, now: Date) {
  return !lastOutboundAt || now.getTime() - lastOutboundAt.getTime() >= GREETING_SILENCE_MS;
}

export const REPEATED_QUESTION_LEAD_INS = [
  "Sem pressa, mas preciso desse detalhe pra seguir:",
  "Pra eu não errar nada, me ajuda com isso:",
  "Acho que não consegui entender direito, então pergunto de novo:",
];

export const LAST_QUESTION_LEAD_INS = ["Por último,", "Pra fechar a cotação,"];

export const BENEFICIARY_RELATION_INVITATION_VARIANTS = [
  "Se quiser, me conta quem são essas pessoas, como você e seu filho, para o corretor já chegar sabendo; se preferir, pode deixar pra lá, sem problema.",
  "Se quiser, me diz o parentesco de cada pessoa, por exemplo, quem é você e quem é seu filho; se preferir, pode deixar pra lá.",
  "Se quiser, me conta quem é cada pessoa do jeito mais fácil pra você; se preferir, pode deixar pra lá.",
];

function lives(memory: ConversationMemory) {
  const value = Number.parseInt(memory.numberOfLives?.value ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function ages(memory: ConversationMemory) {
  return parseAgeValues(memory.age?.value).map(String);
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
      return [
        "Pra eu registrar tudo certinho, pode me dizer seu nome completo?",
        "Antes de tudo, qual é o seu nome completo? Assim eu já anoto direitinho pra você.",
        "Pra eu te atender do jeito certo, me diz seu nome completo, por favor?",
      ];
    case "planType":
      return [
        "Esse plano seria só pra você, pra sua família ou pra sua empresa (CNPJ)? Assim eu já busco o modelo certo.",
        "Me conta, o plano é pra você, pra sua família ou pela empresa (CNPJ)? Com isso eu já sei por onde começar.",
        "Pra eu montar as opções certas: é um plano só seu, pra família ou pra empresa (CNPJ)?",
      ];
    case "numberOfLives":
      if (plan === "empresarial") return [
        "Quantas vidas a empresa quer colocar no plano, contando sócios, funcionários e dependentes? Assim a cotação sai certinha.",
        "E quantas vidas entram no plano da empresa, contando os dependentes? Com esse número eu consigo cotar o valor.",
      ];
      if (plan === "familiar") return [
        "Contando com você, quantas pessoas vão entrar no plano? Assim eu já coto o valor pra família.",
        "E quantas pessoas da família vão entrar, contando com você? Com esse número eu monto a proposta certinha.",
      ];
      return [
        "Quantas pessoas vão entrar no plano? Com esse número eu já consigo cotar o valor.",
        "E o plano seria pra quantas pessoas, no total?",
      ];
    case "age":
      if (plan === "empresarial") return [
        "E qual é mais ou menos a média de idade do pessoal? Isso ajuda a acertar o valor da mensalidade.",
        "Qual seria a idade média do grupo que vai entrar no plano? Assim a proposta fica no ponto certo.",
      ];
      // The plan may be for someone else (a grandchild, a parent): ask about who uses it.
      if (plan === "individual" || count === 1) return [
        "E qual a idade de quem vai usar o plano? Isso ajuda a acertar o valor, que muda por faixa de idade.",
        "Quantos anos tem quem vai usar o plano? Com isso eu calculo direitinho pra você.",
      ];
      if (count) return [
        `E quais as idades das ${count} pessoas? Pode mandar só os números, tipo 35 e 32, que eu anoto tudo.`,
        `Me passa a idade de cada uma das ${count} pessoas? Basta mandar os números, tipo 35 e 32.`,
      ];
      return [
        "E quais as idades de quem vai entrar no plano? Pode mandar só os números, tipo 35 e 32.",
        "Me passa a idade de cada pessoa que vai entrar no plano, assim eu já consigo cotar certinho.",
      ];
    case "city":
      return [
        "Em qual cidade e bairro você mora? Assim eu já busco opções com a rede de hospitais perto de você.",
        "Me conta sua cidade e bairro, que eu procuro opções com rede perto de onde você está.",
      ];
    case "email":
      return [
        "Qual o seu melhor e-mail pra eu te mandar a cotação? Assim você revisa com calma.",
        "Pra qual e-mail posso te enviar a cotação? Assim você olha no seu tempo.",
      ];
  }
}

/**
 * "Já têm plano de saúde hoje?", asked once in the same message as the last question
 * (23/10). A separate final question the customer never answers would leave a qualified
 * lead without a broker, so the answer is optional and the flow never waits for it.
 * Every wording carries CURRENT_PLAN_MARKER ("plano de saúde hoje", ai-agent/memory.ts).
 */
export function currentPlanQuestionVariants(memory: ConversationMemory) {
  const count = lives(memory);
  const plural = (count ?? 1) > 1 || memory.planType?.value === "familiar" || memory.planType?.value === "empresarial";
  return plural
    ? ["Se vocês já têm plano de saúde hoje, me conta qual, que eu comparo pra vocês.", "Se já têm algum plano de saúde hoje, podem me contar qual; assim eu comparo com as opções."]
    : ["Se você já tem plano de saúde hoje, me conta qual, que eu comparo pra você.", "Se já tem algum plano de saúde hoje, pode me contar qual; assim eu comparo com as opções."];
}

export function currentPlanQuestion(memory: ConversationMemory, seed: string) {
  return pick(currentPlanQuestionVariants(memory), `${seed}:current-plan`);
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
  if (include("age")) {
    if (plan === "empresarial" && memory.averageAge?.value) parts.push(`média de ${memory.averageAge.value} anos`);
    else {
      const list = ages(memory);
      const beneficiaries = beneficiariesFromMemory(memory, parseAgeValues(memory.age?.value));
      const linkedInOrder = list.length > 1 && beneficiaries.length === list.length
        && beneficiaries.every((beneficiary, index) => beneficiary.age === Number(list[index]) && beneficiary.relation !== null);
      if (linkedInOrder) {
        const relationLabels: Record<string, string> = { titular: "você", conjuge: "cônjuge", filho: "filho", pai_mae: "pai/mãe", neto: "neto", outro: "outro" };
        const described = list.map((age, index) => {
          const beneficiary = beneficiaries[index]!;
          const relation = beneficiary.relation === "outro"
            ? beneficiary.relationText?.trim() || "outra pessoa"
            : beneficiary.relation ? relationLabels[beneficiary.relation] : "parentesco não informado";
          return `${relation} ${age}`;
        });
        parts.push(`${described.slice(0, -1).join(", ")}${described.length > 1 ? ` e ${described[described.length - 1]}` : ""} anos`);
      } else {
        if (include("numberOfLives") && count && count > 1) parts.push(`${count} ${plan === "empresarial" ? "vidas" : "pessoas"}`);
        if (list.length === 1) parts.push(`${list[0]} anos`);
        else if (list.length > 1) parts.push(`${list.join(" e ")} anos`);
      }
    }
  }
  if (include("numberOfLives") && !include("age") && count && count > 1) {
    parts.push(`${count} ${plan === "empresarial" ? "vidas" : "pessoas"}`);
  }
  if (include("city") && memory.city?.value) parts.push(memory.city.value.trim());
  if (parts.length > 1 && plan && memory.age?.value && parseAgeValues(memory.age.value).length > 1) {
    return `${parts[0]}, ${parts.slice(1).join(", ")}`;
  }
  return joinList(parts);
}

type Ack = { text: string; usesName?: boolean };

/** Confirmations that echo the value of one field. */
export function confirmationVariants(key: QualificationFieldKey, memory: ConversationMemory, name: string | null = null): string[] {
  return fieldAcks(key, memory, name).map((ack) => ack.text);
}

function fieldAcks(key: QualificationFieldKey, memory: ConversationMemory, name: string | null): Ack[] {
  const named = (text: string): Ack[] => (name ? [{ text, usesName: true }] : []);
  switch (key) {
    case "customerName":
      return name
        ? [{ text: `Prazer, ${name}! Obrigado por me dizer seu nome.`, usesName: true }, { text: `Que bom falar com você, ${name}! Obrigado por se apresentar.`, usesName: true }]
        : [{ text: "Obrigado por se apresentar!" }];
    case "planType": {
      const plan = memory.planType?.value;
      if (plan === "individual") return [
        { text: "Entendi, é só pra você. Obrigado por me contar!" },
        { text: "Plano só seu, combinado. Obrigado pela informação." },
        ...named(`Beleza, ${name}, então é um plano só seu.`),
      ];
      if (plan === "familiar") return [
        { text: "Ótimo, então é pra família! Obrigado por me contar." },
        { text: "Pra família, combinado. Obrigado pela informação." },
        ...named(`Perfeito, ${name}, então o plano é pra família.`),
      ];
      return [
        { text: "Entendi, é pela empresa. Obrigado pela informação." },
        { text: "Plano empresarial, combinado. Vou montar a proposta direitinho." },
        ...named(`Beleza, ${name}, então é pela empresa.`),
      ];
    }
    case "numberOfLives": {
      const count = lives(memory);
      if (count === 1 && memory.planType?.value === "empresarial") return [{ text: "1 vida, anotado. Obrigado!" }, { text: "Entendi, uma vida só." }];
      if (count === 1) return [{ text: "Só você, combinado! Obrigado." }, { text: "Uma pessoa, entendi. Obrigado pela informação." }];
      const unit = memory.planType?.value === "empresarial" ? "vidas" : "pessoas";
      return [
        { text: `${count} ${unit}, anotado! Obrigado.` },
        { text: `Beleza, ${count} ${unit} anotadas.` },
        ...named(`Perfeito, ${name}, são ${count} ${unit}.`),
      ];
    }
    case "age": {
      if (memory.planType?.value === "empresarial" && memory.averageAge?.value) return [{ text: `Média de ${memory.averageAge.value} anos, anotado. Obrigado!` }, { text: "Beleza, anotei a idade média do grupo." }];
      const list = ages(memory);
      if (list.length === 1) return [
        { text: `${list[0]} anos, anotado. Obrigado por passar!` },
        { text: `Beleza, ${list[0]} anos.` },
        ...named(`Perfeito, ${name}, já anotei.`),
      ];
      return [{ text: "Perfeito, anotei as idades. Obrigado!" }, { text: "Ótimo, já anotei todas as idades." }];
    }
    case "city": {
      const city = memory.city?.value?.trim() ?? "";
      const place = memory.neighborhood?.value ? `${memory.neighborhood.value.trim()}, ${city}` : city;
      return [
        { text: `${place}, anotado. Isso ajuda muito, obrigado!` },
        { text: `Anotei: ${place}. Obrigado!` },
        ...named(`Perfeito, ${name}, já anotei a sua região.`),
      ];
    }
    case "email":
      return [{ text: "Anotado, obrigado! Sua cotação vai por esse e-mail." }, { text: "E-mail anotado, obrigado por passar." }];
  }
}

function acknowledgement(input: ComposeQuestionInput, name: string | null): string {
  if (input.repeated || !input.answered.length) return "";
  const nameRecentlyUsed = Boolean(name && normalize(input.previousReply).includes(normalize(name)));
  const recentOpeners = new Set((input.recentReplies?.length ? input.recentReplies : [input.previousReply ?? ""])
    .map(firstWord).filter(Boolean));
  if (input.answered.length > 1) {
    const summary = summarizeQualification(input.memory, input.answered);
    if (summary) {
      const options = [`Obrigado pelas respostas, anotei aqui: ${summary}.`, `Perfeito, já registrei: ${summary}.`, `Certo, anotei com cuidado: ${summary}.`];
      const fresh = options.filter((text) => !recentOpeners.has(firstWord(text)));
      return pick(fresh.length ? fresh : options, `${input.seed}:ack`);
    }
  }
  const candidates = fieldAcks(input.answered[0]!, input.memory, name)
    .filter((ack) => !(ack.usesName && nameRecentlyUsed))
    .filter((ack) => !recentOpeners.has(firstWord(ack.text)));
  const safeFallback = ["Certo, obrigado por me contar!", "Entendi, já anotei.", "Valeu por me explicar!", "Anotei com cuidado."]
    .filter((text) => !recentOpeners.has(firstWord(text)));
  const pool = candidates.length ? candidates : safeFallback.length ? safeFallback.map((text) => ({ text })) : fieldAcks(input.answered[0]!, input.memory, null);
  return pick(pool, `${input.seed}:ack`).text;
}

/** One qualification question with its confirmation, progress cue and rephrasing. */
export function composeQuestionReply(input: ComposeQuestionInput): string {
  const name = input.memory.customerFirstName?.value?.trim() || input.memory.customerName?.value?.trim().split(/\s+/)[0] || null;
  const customText = input.customText;
  if (customText?.trim()) return customText;

  const variants = questionVariants(input.key, input.memory);
  const question = pick(variants, `${input.seed}:q`);
  const recentOpeners = new Set((input.recentReplies?.length ? input.recentReplies : [input.previousReply ?? ""])
    .map(firstWord).filter(Boolean));
  const greet = input.periodGreeting ? `${greetingForHour(input.now ?? new Date())}!` : input.greetingText ?? "";
  if (input.repeated) {
    const choices = REPEATED_QUESTION_LEAD_INS.filter((lead) => !recentOpeners.has(firstWord(lead)));
    const lead = pick(choices.length ? choices : REPEATED_QUESTION_LEAD_INS, `${input.seed}:r`);
    const body = `${lead} ${lowerFirst(question)}`;
    const safeBody = greet && body.includes("? ") ? body.slice(0, body.indexOf("? ") + 1) : body;
    return [greet, safeBody].filter(Boolean).join(" ");
  }
  const includeCurrentPlan = input.askCurrentPlan && !input.periodGreeting && !input.greetingText;
  const ack = input.periodGreeting || input.greetingText ? "" : firstSentence(acknowledgement(input, name));
  const lastOptions = LAST_QUESTION_LEAD_INS.filter((lead) => !recentOpeners.has(firstWord(lead)));
  const lastLead = pick(lastOptions.length ? lastOptions : LAST_QUESTION_LEAD_INS, `${input.seed}:last`);
  const asked = input.last ? `${lastLead} ${lowerFirst(question)}` : question;
  // Same paragraph as the last question, so the next answer is read against both.
  const mainQuestion = includeCurrentPlan && ack ? firstQuestionSentence(asked) : asked;
  const body = includeCurrentPlan ? `${mainQuestion} ${currentPlanQuestion(input.memory, input.seed)}` : asked;
  const safeQuestionBody = greet && body.includes("? ") ? body.slice(0, body.indexOf("? ") + 1) : body;
  const response = [greet, ack, safeQuestionBody].filter(Boolean).join(" ");
  if (greet) return response;

  if (!ack && recentOpeners.has(firstWord(response))) {
    const openers = ["Só pra confirmar:", "Combinado:", "Pra eu acertar:", "Me conta:", "Certo:"]
      .filter((opener) => !recentOpeners.has(firstWord(opener)));
    return `${pick(openers.length ? openers : ["Combinado:"], `${input.seed}:open`)} ${response}`;
  }
  return response;
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
export function composeGreeting(input: { name?: string | null; assistantName?: string | null; companyName?: string | null; seed: string; now?: Date }) {
  void input.seed;
  const name = greetingName(input.name);
  const company = input.companyName?.trim() || "Âncora Saúde";
  const assistant = input.assistantName?.trim();
  const personal = assistant && !/^assistente\b/i.test(assistant) && assistant.split(/\s+/).length <= 3 ? assistant : null;
  const who = personal ? `aqui é ${personal}, da ${company}` : `aqui é da ${company}`;
  return `${greetingForHour(input.now ?? new Date())}${name ? `, ${name}` : ""}, ${who}.`;
}

export function beneficiaryRelationInvitation(memory: ConversationMemory, seed: string) {
  const plan = memory.planType?.value;
  const ageCount = parseAgeValues(memory.age?.value).length;
  const existing = beneficiariesFromMemory(memory, parseAgeValues(memory.age?.value));
  if ((plan !== "individual" && plan !== "familiar") || ageCount < 2 || memory.relationAsked || existing.some((beneficiary) => beneficiary.relation !== null)) return null;
  return pick(BENEFICIARY_RELATION_INVITATION_VARIANTS, `${seed}:beneficiary-relation`);
}

/** Original question wording kept searchable so older outbound messages still count as asked. */
export const LEGACY_QUESTION_TEXTS: Partial<Record<QualificationFieldKey, readonly string[]>> = {
  customerName: ["Pra eu te atender direitinho, qual é o seu nome completo?", "Me diz seu nome completo, por favor?"],
  planType: [
    "Me conta: o plano seria só pra você, pra sua família ou pra sua empresa (CNPJ)?",
    "Você tá pensando num plano só seu, pra família ou pela empresa (CNPJ)?",
    "O plano seria pra você, pra família ou pra empresa (CNPJ)?",
  ],
  numberOfLives: [
    "Quantas vidas a empresa quer colocar no plano, contando sócios, funcionários e dependentes?",
    "E quantas vidas entram no plano da empresa, contando os dependentes?",
    "Contando com você, quantas pessoas vão entrar no plano?",
    "E quantas pessoas da família vão entrar, contando com você?",
    "Quantas pessoas vão entrar no plano?",
    "E o plano seria pra quantas pessoas?",
  ],
  age: [
    "E qual é mais ou menos a média de idade do pessoal?",
    "Qual seria a idade média do grupo que vai entrar no plano?",
    "E qual a idade de quem vai usar o plano?",
    "Quantos anos tem quem vai usar o plano?",
    "E quais as idades das pessoas? Pode mandar só os números, tipo 35 e 32.",
    "Me passa a idade de cada uma das pessoas?",
    "E quais as idades de quem vai entrar no plano?",
    "Me passa a idade de cada pessoa que vai entrar no plano?",
  ],
  city: ["Em qual cidade e bairro você mora? Assim já busco opções com hospitais pertinho de você.", "Me conta sua cidade e bairro, que eu procuro opções com rede perto de você."],
  email: ["Qual o seu melhor e-mail pra eu te mandar a cotação?", "Pra qual e-mail posso te mandar a cotação?"],
};

/** True when any wording of this question (current or legacy) was already sent. */
export function wasQuestionAsked(key: QualificationFieldKey, memory: ConversationMemory, legacyText: string, pastOutboundTexts: Iterable<string>, customText?: string | null) {
  const dynamicAgeLegacy = key === "age" && lives(memory) ? [
    `E quais as idades das ${lives(memory)} pessoas? Pode mandar só os números, tipo 35 e 32.`,
    `Me passa a idade de cada uma das ${lives(memory)} pessoas?`,
  ] : [];
  const needles = [legacyText, ...questionVariants(key, memory), ...(LEGACY_QUESTION_TEXTS[key] ?? []), ...dynamicAgeLegacy, ...(customText?.trim() ? [customText.trim()] : [])].map((text) => normalize(text));
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
    .replace(/\{\{\s*semRepetir\s*\}\}/gi, summary ? ", sem você precisar repetir nada" : "")
    .replace(/\s+([!?.,])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Default text when a customer asks for a person, and when the qualification is complete. Written
 * for the working hours: a broker answers "em instantes". Vinicios, 26/10: no promise of privacy.
 */
export const DEFAULT_HUMAN_REQUEST_TEXT = "Claro, {{nome}}, já passei seu atendimento para um corretor especialista, com tudo que você me contou ({{resumo}}). Ele continua por aqui em instantes{{semRepetir}}.";
export const DEFAULT_QUALIFIED_HANDOFF_TEXT = "Muito obrigado, {{nome}}! Já tenho o que preciso ({{resumo}}), então passei seu atendimento para um corretor especialista. Ele continua por aqui em instantes{{semRepetir}}.";

/**
 * Outside the broker's working hours (Sunday, national holidays, 19h to 9h) the text says when the
 * next one answers: "{{quando}}" is filled by withBrokerReturnPhrase (broker-window.ts).
 */
export const AFTER_HOURS_QUALIFIED_HANDOFF_TEXT = "Obrigado, {{nome}}! Com essas informações ({{resumo}}), seu atendimento já está com a nossa equipe. Um corretor fala com você por aqui {{quando}}.";
export const AFTER_HOURS_HUMAN_REQUEST_TEXT = "Claro, {{nome}}, já deixei tudo com a nossa equipe ({{resumo}}). Um corretor continua a conversa por aqui {{quando}}{{semRepetir}}.";

/** Outside working hours: Sunday, national holidays, 19h to 9h (São Paulo). */
export function isAfterHoursInSaoPaulo(now: Date = new Date()) {
  return !brokerAvailability(now).open;
}

/**
 * Former default handoff texts, saved on tenants without being customized.
 * They give way to the current default (with name and summary); a text the
 * tenant actually wrote is kept.
 */
const RETIRED_HANDOFF_TEXTS = new Set([
  "Vou encaminhar você para um corretor da equipe agora.",
  "Obrigado pelas informações. Vou encaminhar seu atendimento para um corretor da equipe agora.",
  "Obrigado, {{nome}}! Com essas informações ({{resumo}}), já passei seu atendimento para um corretor especialista. Ele continua a conversa por aqui em instantes.",
  "Claro, {{nome}}! Já passei seu atendimento para um corretor especialista com o que você me contou ({{resumo}}). Ele continua a conversa por aqui em instantes.",
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
    `Entendi que o valor está pesando; vou procurar uma opção que caiba melhor no orçamento de ${you}, com calma.`,
    `Faz sentido querer reduzir; vou montar opções mais em conta para ${you} escolher com calma.`,
    `Entendi, você quer pagar menos sem perder atendimento; vou buscar boas opções para ${you}.`,
  ], `${input.seed}:price`);
}

export function shouldAddPriceConcern(customerConcern: string | null, customQuestionText?: string | null) {
  return Boolean(customerConcern && !customQuestionText?.trim());
}
