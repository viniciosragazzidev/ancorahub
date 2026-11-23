import type { ChatBlock, ChatChoice, ChatProgress } from "@/components/chat/types";

/**
 * Formulário público de qualificação (/formulario, 23/11/2026): a mesma conversa passo a passo da
 * Cotação e da venda no Lite, para quem chega pelo link. No máximo 7 passos, e o primeiro decide o
 * ramo (CPF ou CNPJ). Puro: a tela guarda as respostas e pergunta aqui o que vem depois; o servidor
 * usa as mesmas validações.
 */

export type FormKind = "cpf" | "cnpj";
export type CurrentPlan = "tem_plano" | "sem_plano";

export type FormAnswers = {
  kind?: FormKind;
  name?: string;
  /** O que a pessoa tocou ou escreveu sobre quem entra no plano ("19 a 29 anos", "35, 32 e 8 anos", "3 a 9 pessoas"). */
  people?: string;
  /** Idades digitadas (CPF), quando ela escreveu em vez de tocar numa faixa. */
  ages?: number[];
  /** Quantas pessoas, quando dá para saber. */
  lives?: number | null;
  neighborhood?: string;
  city?: string;
  currentPlan?: CurrentPlan;
  /** A pergunta própria de cada ramo: quando contratar (CPF) ou o CNPJ (CNPJ). */
  qualifier?: string;
  /** Celular em dígitos com o 55 ("5521999990000"). */
  phone?: string;
  /** A pessoa conferiu o número e tocou em Enviar. */
  confirmed?: boolean;
};

export type FormStep = "kind" | "name" | "people" | "place" | "plan" | "qualifier" | "phone";
export type FormAwaiting = FormStep | "confirm" | "done";

export const FORM_STEPS: readonly FormStep[] = ["kind", "name", "people", "place", "plan", "qualifier", "phone"];
export const FORM_TOTAL_STEPS = FORM_STEPS.length;

export const KIND_LABEL: Record<FormKind, string> = { cpf: "Para mim ou minha família (CPF)", cnpj: "Para minha empresa (CNPJ)" };
export const CURRENT_PLAN_LABEL: Record<CurrentPlan, string> = {
  tem_plano: "Já possuo plano, mas quero saber se estou pagando caro",
  sem_plano: "Não tenho um plano",
};

type Option = { id: string; label: string; lives?: number | null };

const CPF_AGE_BANDS: Option[] = [
  { id: "0-18", label: "Até 18 anos", lives: 1 },
  { id: "19-29", label: "19 a 29 anos", lives: 1 },
  { id: "30-39", label: "30 a 39 anos", lives: 1 },
  { id: "40-49", label: "40 a 49 anos", lives: 1 },
  { id: "50-58", label: "50 a 58 anos", lives: 1 },
  { id: "59+", label: "59 anos ou mais", lives: 1 },
];
const CNPJ_LIFE_BANDS: Option[] = [
  { id: "1-2", label: "1 ou 2 pessoas", lives: null },
  { id: "3-9", label: "3 a 9 pessoas", lives: null },
  { id: "10-29", label: "10 a 29 pessoas", lives: null },
  { id: "30+", label: "30 pessoas ou mais", lives: null },
];
export const CPF_QUALIFIERS: Option[] = [
  { id: "agora", label: "O quanto antes" },
  { id: "30-dias", label: "Nos próximos 30 dias" },
  { id: "pesquisando", label: "Só estou pesquisando" },
];
export const CNPJ_QUALIFIERS: Option[] = [
  { id: "mei", label: "Sim, sou MEI" },
  { id: "me-epp", label: "Sim, ME, EPP ou outro" },
  { id: "abrindo", label: "Ainda estou abrindo" },
];

export function peopleOptions(kind: FormKind) {
  return kind === "cnpj" ? CNPJ_LIFE_BANDS : CPF_AGE_BANDS;
}
export function qualifierOptions(kind: FormKind) {
  return kind === "cnpj" ? CNPJ_QUALIFIERS : CPF_QUALIFIERS;
}
export function qualifierQuestion(kind: FormKind) {
  return kind === "cnpj" ? "Sua empresa tem CNPJ ativo?" : "Quando você quer contratar?";
}
export function qualifierLabel(kind: FormKind, id: string | undefined) {
  return qualifierOptions(kind).find((option) => option.id === id)?.label ?? null;
}

// ─── Validações (as mesmas no navegador e no servidor) ─────────────────────

const clean = (value: string) => value.normalize("NFC").replace(/\s+/g, " ").trim();

export function parseName(raw: string): { name: string } | { error: string } {
  const name = clean(raw).replace(/[<>{}[\]\\]/g, "");
  if (name.length < 2 || !/\p{L}/u.test(name)) return { error: "Me diga seu nome, por favor. Ex.: Maria Souza" };
  if (name.length > 80) return { error: "Esse nome ficou muito longo. Pode escrever só o nome e o sobrenome." };
  if (/\d{4,}/.test(name)) return { error: "Parece um número. Me diga seu nome, por favor." };
  return { name };
}

function joinAges(ages: number[]) {
  if (ages.length === 1) return `${ages[0]} anos`;
  return `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]} anos`;
}

/** Idades digitadas ("35, 32 e 8") ou quantas pessoas ("12"), conforme o ramo. */
export function parsePeopleText(kind: FormKind, raw: string): { people: string; ages?: number[]; lives: number | null } | { error: string } {
  const numbers = (clean(raw).match(/\d{1,3}/g) ?? []).map(Number);
  if (kind === "cnpj") {
    const lives = numbers[0];
    if (numbers.length !== 1 || !lives || lives > 5000) return { error: "Quantas pessoas vão entrar no plano? Toque numa opção ou escreva o número. Ex.: 4" };
    return { people: `${lives} ${lives === 1 ? "pessoa" : "pessoas"}`, lives };
  }
  if (!numbers.length || numbers.length > 15 || numbers.some((age) => age > 110)) {
    return { error: "Toque na faixa de idade ou escreva as idades de quem vai no plano. Ex.: 35, 32 e 8" };
  }
  return { people: joinAges(numbers), ages: numbers, lives: numbers.length };
}

/** "Icaraí, Niterói" (ou com hífen, barra ou " em "): bairro e cidade. */
export function parsePlace(raw: string): { neighborhood: string; city: string } | { error: string } {
  const parts = clean(raw).replace(/[<>{}[\]\\]/g, "").split(/\s*,\s*|\s+-\s+|\s*\/\s*|\s+em\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { error: "Me diga o bairro e a cidade, separados por vírgula. Ex.: Icaraí, Niterói" };
  const neighborhood = parts[0]!;
  const city = parts.slice(1).join(", ");
  if (neighborhood.length < 2 || city.length < 2 || !/\p{L}/u.test(neighborhood) || !/\p{L}/u.test(city)) {
    return { error: "Me diga o bairro e a cidade, separados por vírgula. Ex.: Icaraí, Niterói" };
  }
  if (neighborhood.length > 80 || city.length > 80) return { error: "Ficou muito longo. Escreva só o bairro e a cidade. Ex.: Icaraí, Niterói" };
  return { neighborhood, city };
}

const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Celular brasileiro com DDD: devolve os dígitos com o 55 ("5521999990000"). */
export function parseBrazilianMobile(raw: string): { phone: string } | { error: string } {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 11) return { error: "Escreva o celular com DDD, só os números. Ex.: 21 99999-0000" };
  const ddd = Number(digits.slice(0, 2));
  const number = digits.slice(2);
  if (!VALID_DDD.has(ddd)) return { error: "Esse DDD não existe. Confira e escreva de novo. Ex.: 21 99999-0000" };
  if (number[0] !== "9") return { error: "Esse número não parece de celular. O celular começa com 9 depois do DDD." };
  if (/^(\d)\1+$/.test(number)) return { error: "Esse número não parece válido. Confira e escreva de novo." };
  return { phone: `55${digits}` };
}

export function formatMobile(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : phone;
}

// ─── Andamento ─────────────────────────────────────────────────────────────

export function formAwaiting(answers: FormAnswers): FormAwaiting {
  if (!answers.kind) return "kind";
  if (!answers.name) return "name";
  if (!answers.people) return "people";
  if (!answers.city || !answers.neighborhood) return "place";
  if (!answers.currentPlan) return "plan";
  if (!answers.qualifier) return "qualifier";
  if (!answers.phone) return "phone";
  return answers.confirmed ? "done" : "confirm";
}

export function formProgress(answers: FormAnswers): ChatProgress {
  const awaiting = formAwaiting(answers);
  const index = FORM_STEPS.indexOf(awaiting as FormStep);
  return { title: "Suas respostas", done: index < 0 ? FORM_TOTAL_STEPS : index, total: FORM_TOTAL_STEPS };
}

/** "field:value" → [field, value]. */
export function splitFormChoice(raw: string): [string, string] {
  const at = raw.indexOf(":");
  return at < 0 ? [raw, ""] : [raw.slice(0, at), raw.slice(at + 1)];
}

const local = (field: string, value: string) => ({ kind: "local" as const, value: `${field}:${value}` });
const firstName = (name: string | undefined) => (name ?? "").split(" ")[0] ?? "";

/** Toque numa opção: a resposta nova, ou null quando a opção não vale para a pergunta em aberto. */
export function applyFormChoice(answers: FormAnswers, value: string): FormAnswers | null {
  const [field, raw] = splitFormChoice(value);
  const awaiting = formAwaiting(answers);
  if (field === "fixPhone") return { ...answers, phone: undefined, confirmed: false };
  if (field !== awaiting) return null;
  switch (field) {
    case "kind":
      return raw === "cpf" || raw === "cnpj" ? { ...answers, kind: raw } : null;
    case "people": {
      const option = peopleOptions(answers.kind!).find((item) => item.id === raw);
      return option ? { ...answers, people: option.label, ages: undefined, lives: option.lives ?? null } : null;
    }
    case "plan":
      return raw === "tem_plano" || raw === "sem_plano" ? { ...answers, currentPlan: raw } : null;
    case "qualifier":
      return qualifierOptions(answers.kind!).some((item) => item.id === raw) ? { ...answers, qualifier: raw } : null;
    case "confirm":
      return { ...answers, confirmed: true };
    default:
      return null;
  }
}

/** Texto digitado: responde a pergunta em aberto, ou devolve o que falta explicar. */
export function applyFormText(answers: FormAnswers, text: string): { answers: FormAnswers } | { error: string } {
  const awaiting = formAwaiting(answers);
  switch (awaiting) {
    case "kind": {
      const folded = clean(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      if (/\b(cnpj|empresa|mei|pme|pj)\b/.test(folded)) return { answers: { ...answers, kind: "cnpj" } };
      if (/\b(cpf|eu|mim|familia|pessoa fisica)\b/.test(folded)) return { answers: { ...answers, kind: "cpf" } };
      return { error: "Toque numa das opções acima: CPF para você ou sua família, CNPJ para a sua empresa." };
    }
    case "name": {
      const parsed = parseName(text);
      return "error" in parsed ? parsed : { answers: { ...answers, name: parsed.name } };
    }
    case "people": {
      const parsed = parsePeopleText(answers.kind!, text);
      return "error" in parsed ? parsed : { answers: { ...answers, people: parsed.people, ages: parsed.ages, lives: parsed.lives } };
    }
    case "place": {
      const parsed = parsePlace(text);
      return "error" in parsed ? parsed : { answers: { ...answers, ...parsed } };
    }
    case "phone":
    case "confirm": {
      // Na confirmação, escrever outro número troca o que estava.
      const parsed = parseBrazilianMobile(text);
      return "error" in parsed ? parsed : { answers: { ...answers, phone: parsed.phone, confirmed: false } };
    }
    case "plan":
    case "qualifier":
      return { error: "Toque numa das opções acima para seguir." };
    default:
      return { error: "Suas respostas já foram enviadas." };
  }
}

/** Abertura da conversa. */
export function introBlocks(): ChatBlock[] {
  return [
    { type: "assistant", id: "a-intro", text: "Oi! São no máximo 7 perguntas rápidas para um corretor da Âncora achar o plano de saúde certo para você." },
    ...nextFormBlocks({}, 0),
  ];
}

/** A pergunta do que falta (a confirmação no fim; nada depois de enviado). */
export function nextFormBlocks(answers: FormAnswers, round: number): ChatBlock[] {
  const id = (name: string) => `${name}-${round}`;
  const kind = answers.kind ?? "cpf";
  switch (formAwaiting(answers)) {
    case "kind":
      return [{
        type: "question", id: id("q-kind"), prompt: "Para quem é o plano?",
        choices: (["cpf", "cnpj"] as const).map((value) => ({ id: `kind-${value}`, label: KIND_LABEL[value], action: local("kind", value) })),
      }];
    case "name":
      return [{ type: "assistant", id: id("a-name"), text: kind === "cnpj" ? "Ótimo. Qual o seu nome?" : "Ótimo. Como você se chama?" }];
    case "people": {
      const choices: ChatChoice[] = peopleOptions(kind).map((option) => ({ id: `people-${option.id}`, label: option.label, action: local("people", option.id) }));
      return [{
        type: "question", id: id("q-people"),
        prompt: kind === "cnpj"
          ? `Prazer, ${firstName(answers.name)}. Quantas pessoas vão entrar no plano da empresa?`
          : `Prazer, ${firstName(answers.name)}. Qual a idade de quem vai no plano? Se forem mais pessoas, escreva as idades aqui embaixo.`,
        choices,
      }];
    }
    case "place":
      return [{ type: "assistant", id: id("a-place"), text: kind === "cnpj" ? "Em qual bairro e cidade fica a empresa? Ex.: Centro, Niterói" : "Em qual bairro e cidade você mora? Ex.: Icaraí, Niterói" }];
    case "plan":
      return [{
        type: "question", id: id("q-plan"), prompt: "Você já tem plano de saúde?",
        choices: (["tem_plano", "sem_plano"] as const).map((value) => ({ id: `plan-${value}`, label: CURRENT_PLAN_LABEL[value], action: local("plan", value) })),
      }];
    case "qualifier":
      return [{
        type: "question", id: id("q-qualifier"), prompt: qualifierQuestion(kind),
        choices: qualifierOptions(kind).map((option) => ({ id: `qualifier-${option.id}`, label: option.label, action: local("qualifier", option.id) })),
      }];
    case "phone":
      return [{ type: "assistant", id: id("a-phone"), text: "Última pergunta. Qual o seu WhatsApp com DDD? É por ele que o corretor vai falar com você." }];
    case "confirm":
      return [{
        type: "question", id: id("q-confirm"), prompt: `Confere o seu WhatsApp: ${formatMobile(answers.phone!)}. Posso enviar?`,
        choices: [
          { id: "confirm-send", label: "Enviar", action: local("confirm", "1") },
          { id: "confirm-fix", label: "Corrigir o número", action: local("fixPhone", "1") },
        ],
      }];
    default:
      return [];
  }
}

/** Placeholder e teclado do campo para a pergunta em aberto. */
export function composerFor(answers: FormAnswers): { placeholder?: string; input?: { inputMode?: "text" | "numeric"; label?: string } } {
  switch (formAwaiting(answers)) {
    case "name": return { placeholder: "Ex.: Maria Souza", input: { label: "Seu nome" } };
    case "people": return answers.kind === "cnpj"
      ? { placeholder: "Ou escreva o número. Ex.: 4", input: { inputMode: "numeric", label: "Quantas pessoas vão entrar no plano" } }
      : { placeholder: "Ou escreva as idades. Ex.: 35, 32 e 8", input: { label: "Idades de quem vai no plano" } };
    case "place": return { placeholder: "Ex.: Icaraí, Niterói", input: { label: "Bairro e cidade" } };
    case "phone": return { placeholder: "Ex.: 21 99999-0000", input: { inputMode: "numeric", label: "Seu WhatsApp com DDD" } };
    case "confirm": return { placeholder: "Ou escreva outro número", input: { inputMode: "numeric", label: "Seu WhatsApp com DDD" } };
    case "done": return { placeholder: "Respostas enviadas" };
    default: return { placeholder: "Escolha uma opção acima" };
  }
}

// ─── O que vai para o servidor ─────────────────────────────────────────────

export type PublicFormSubmission = {
  kind: FormKind;
  name: string;
  people: string;
  ages: number[] | null;
  lives: number | null;
  neighborhood: string;
  city: string;
  currentPlan: CurrentPlan;
  qualifier: string;
  phone: string;
  /** Honeypot: escondido de quem usa a tela; robô preenche. */
  website: string;
  /** A mesma em toda tentativa desta conversa: reenviar nunca cria dois leads. */
  idempotencyKey: string;
};

export type PublicFormResult = { ok: true } | { ok: false; error: string; retryable: boolean };

export function toSubmission(answers: FormAnswers, idempotencyKey: string, website = ""): PublicFormSubmission | null {
  if (!answers.kind || !answers.name || !answers.people || !answers.neighborhood || !answers.city || !answers.currentPlan || !answers.qualifier || !answers.phone) return null;
  return {
    kind: answers.kind, name: answers.name, people: answers.people, ages: answers.ages ?? null, lives: answers.lives ?? null,
    neighborhood: answers.neighborhood, city: answers.city, currentPlan: answers.currentPlan, qualifier: answers.qualifier,
    phone: answers.phone, website, idempotencyKey,
  };
}

/** Respostas como "Pergunta: resposta" (a ficha do lead já mostra assim) e os campos que a ficha reconhece. */
export function submissionToLeadData(submission: PublicFormSubmission) {
  const cnpj = submission.kind === "cnpj";
  const formData: Record<string, string> = {
    tipoPlano: cnpj ? "pme" : submission.lives && submission.lives > 1 ? "familiar" : "individual",
    bairro: submission.neighborhood,
    cidade: submission.city,
    ...(cnpj ? { qtdVidas: submission.people } : { idades: submission.people }),
  };
  const formAnswers = [
    `Para quem: ${cnpj ? "Empresa (CNPJ)" : "Pessoa física (CPF)"}`,
    `Plano atual: ${CURRENT_PLAN_LABEL[submission.currentPlan]}`,
    `${qualifierQuestion(submission.kind).replace(/\?$/, "")}: ${qualifierLabel(submission.kind, submission.qualifier) ?? submission.qualifier}`,
  ];
  return { formData, formAnswers, leadType: cnpj ? ("PME" as const) : ("PF" as const), livesCount: submission.lives };
}
