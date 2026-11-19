import type { ChatBlock, ChatChoice, ChatProgress } from "@/components/chat/types";

/**
 * Registrar venda em conversa (19/11): no lugar dos formulários, o assistente pergunta uma coisa por vez (tipo de
 * plano, idades, operadora, plano, valor e início da vigência) ou lê o contrato e só pergunta o que faltar.
 * Puro: a tela guarda as respostas e pergunta a este módulo o que vem depois.
 */
export type SalePlanType = "individual" | "familiar" | "pme" | "empresarial";
export const PLAN_TYPE_LABEL: Record<SalePlanType, string> = { individual: "Individual", familiar: "Familiar", pme: "PME", empresarial: "Empresarial" };
const PLAN_TYPE_ORDER: SalePlanType[] = ["individual", "familiar", "pme", "empresarial"];

/**
 * Planos da corretora: o catálogo (global liberado e privado) e o catálogo antigo (`carrier_plans`), que é o único
 * que a venda liga por id (`sales.carrier_plan_id`, comissões). `source` diz de onde veio cada um.
 */
export type SaleCatalogPlan = { id: string; name: string; type: SalePlanType; source?: "legacy" | "catalog" };
/** `legacyId`: a operadora no catálogo antigo (`carriers`), quando existe com o mesmo nome. */
export type SaleCatalogCarrier = { id: string; name: string; legacyId?: string | null; plans: SaleCatalogPlan[] };

/** O que a venda grava a partir da operadora e do plano escolhidos. */
export function saleCatalogSelection(catalog: SaleCatalog, carrierId: string | null | undefined, planId: string | null | undefined) {
  const carrier = catalog.carriers.find((item) => item.id === carrierId) ?? null;
  const plan = carrier?.plans.find((item) => item.id === planId) ?? null;
  return {
    carrierId: carrier?.legacyId ?? null,
    planId: plan && (plan.source ?? "legacy") === "legacy" ? plan.id : null,
    leadPlanId: plan?.id ?? null,
    carrierName: carrier?.name ?? null,
    planName: plan?.name ?? null,
  };
}
export type SaleCatalog = { carriers: SaleCatalogCarrier[] };

export type SaleRelationship = "titular" | "conjuge" | "filho" | "outro";
export const RELATIONSHIP_LABEL: Record<SaleRelationship, string> = { titular: "Titular", conjuge: "Cônjuge", filho: "Filho(a)", outro: "Dependente" };
/** Uma pessoa do contrato: o titular primeiro, depois os dependentes. */
export type SalePerson = { name: string | null; age: number | null; birthDate: string | null; cpf: string | null; relationship: SaleRelationship };

export type SalePaymentMethod = "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro";
export const PAYMENT_LABEL: Record<SalePaymentMethod, string> = { boleto: "Boleto", debito_automatico: "Débito automático", cartao_credito: "Cartão de crédito", desconto_folha: "Desconto em folha", outro: "Outro" };

/** O arquivo do contrato já guardado (POST /api/documents/upload); vira documento do lead quando a venda é registrada. */
export type SaleContractFile = { filename: string; fileUrl: string; storageKey?: string; mimeType?: string; sizeBytes?: number; checksumSha256?: string };

/** Campos que podem vir do contrato (marcados "Do contrato" no resumo). */
export type SaleField = "planType" | "people" | "carrier" | "plan" | "value" | "start" | "policy" | "payment" | "term";

export type SaleAnswers = {
  planType?: SalePlanType;
  ages?: number[];
  /** null: a operadora não está no catálogo (a venda segue sem vínculo de plano). */
  carrierId?: string | null;
  planId?: string | null;
  monthlyValue?: number;
  coverageStartDate?: string;
  /** O que veio do contrato lido pela IA. */
  fromContract?: boolean;
  /** Pessoas com nome, nascimento e CPF (só pelo contrato). */
  people?: SalePerson[];
  policyNumber?: string;
  paymentMethod?: SalePaymentMethod;
  contractTermMonths?: number;
  contract?: SaleContractFile | null;
  /** Quais respostas vieram do contrato. */
  sourced?: SaleField[];
};

export type SaleAwaiting = "planType" | "ages" | "carrier" | "plan" | "value" | "start" | "done";

export const SALE_STEPS = 6;

export function saleAwaiting(answers: SaleAnswers, catalog: SaleCatalog): SaleAwaiting {
  if (!answers.planType) return "planType";
  if (!answers.ages?.length) return "ages";
  if (answers.carrierId === undefined) return "carrier";
  if (answers.planId === undefined) {
    // Operadora fora do catálogo ou sem planos: não há o que escolher.
    const carrier = catalog.carriers.find((item) => item.id === answers.carrierId);
    if (!carrier || !carrier.plans.length) return "value";
    return "plan";
  }
  if (!answers.monthlyValue) return "value";
  if (!answers.coverageStartDate) return "start";
  return "done";
}

export function saleProgress(answers: SaleAnswers): ChatProgress {
  const done = [answers.planType, answers.ages?.length ? answers.ages : undefined, answers.carrierId, answers.planId, answers.monthlyValue, answers.coverageStartDate]
    .filter((value) => value !== undefined).length;
  return { title: "Registrando a venda", done, total: SALE_STEPS };
}

/** "35, 32 e 8" → [35, 32, 8]. Individual é uma vida só; PME e empresarial, pelo menos 2. */
export function parseSaleAges(text: string, planType: SalePlanType | undefined): { ages: number[] } | { error: string } {
  const ages = (text.match(/\d+/g) ?? []).map(Number);
  if (!ages.length) return { error: "Não achei nenhuma idade. Escreva só os números, o titular primeiro. Ex.: 35, 32, 8" };
  if (ages.some((age) => age > 120)) return { error: "Alguma idade passou de 120 anos. Confere e manda de novo?" };
  if (ages.length > 30) return { error: "Cabem até 30 vidas por aqui. Para mais, fale com a direção." };
  if (planType === "individual" && ages.length > 1) return { error: "Individual é uma vida só. Se tem dependentes, toque em Corrigir e escolha Familiar." };
  if ((planType === "pme" || planType === "empresarial") && ages.length < 2) return { error: "Plano de empresa precisa de pelo menos 2 vidas. Manda as idades de todos." };
  return { ages };
}

/** "1.250,90", "R$ 1250", "1250.9" → 1250.9. */
export function parseSaleMoney(text: string): { value: number } | { error: string } {
  const raw = text.replace(/[^\d,.]/g, "");
  if (!raw) return { error: "Não achei o valor. Escreva só o número. Ex.: 1.250,90" };
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return { error: "Esse valor não parece certo. Ex.: 1.250,90" };
  if (value > 1_000_000) return { error: "Esse valor passou de R$ 1 milhão por mês. Confere e manda de novo?" };
  return { value: Math.round(value * 100) / 100 };
}

/** "10/12", "10/12/2026" → "2026-12-10" (ano omitido: a próxima vez que a data acontece). */
export function parseSaleDate(text: string, today: Date): { date: string } | { error: string } {
  const match = /(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{2,4}))?/.exec(text);
  if (!match) return { error: "Escreva a data assim: 10/12/2026." };
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : today.getFullYear();
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return { error: "Essa data não existe. Confere e manda de novo?" };
  if (!match[3] && candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate() - 31)) year += 1;
  return { date: dateKey(new Date(year, month - 1, day)) };
}

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateLabel(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

export function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Vidas por extenso: "3 vidas: titular de 35 e 2 dependentes (32 e 8)". */
export function livesLine(ages: number[]) {
  const [holder, ...rest] = ages;
  if (!rest.length) return `1 vida: titular de ${holder} anos`;
  const list = rest.length === 1 ? `${rest[0]}` : `${rest.slice(0, -1).join(", ")} e ${rest[rest.length - 1]}`;
  return `${ages.length} vidas: titular de ${holder} e ${rest.length} ${rest.length === 1 ? "dependente" : "dependentes"} (${list})`;
}

function local(field: string, value: string): ChatChoice["action"] {
  return { kind: "local", value: `${field}:${value}` };
}

export function splitSaleChoice(value: string): [string, string] {
  const index = value.indexOf(":");
  return index === -1 ? [value, ""] : [value.slice(0, index), value.slice(index + 1)];
}

/** Operadoras que têm plano do tipo escolhido primeiro; as outras continuam na lista. */
function carriersFor(catalog: SaleCatalog, planType: SalePlanType | undefined) {
  const withType = catalog.carriers.filter((carrier) => carrier.plans.some((plan) => plan.type === planType));
  const rest = catalog.carriers.filter((carrier) => !withType.includes(carrier));
  return [...withType, ...rest];
}

export function plansFor(catalog: SaleCatalog, carrierId: string | null | undefined, planType: SalePlanType | undefined) {
  const carrier = catalog.carriers.find((item) => item.id === carrierId);
  if (!carrier) return [];
  const same = carrier.plans.filter((plan) => plan.type === planType);
  return same.length ? same : carrier.plans;
}

/** Datas prontas do início da vigência: sem digitar. */
export function startOptions(today: Date) {
  const nextFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextTenth = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  return [
    { key: dateKey(nextFirst), label: "Dia 1º do mês que vem", hint: dateLabel(dateKey(nextFirst)) },
    { key: dateKey(nextTenth), label: "Dia 10 do mês que vem", hint: dateLabel(dateKey(nextTenth)) },
    { key: dateKey(today), label: "Hoje", hint: dateLabel(dateKey(today)) },
  ];
}

/** A pergunta do que falta (ou o resumo para confirmar quando está tudo respondido). */
export function nextSaleBlocks(answers: SaleAnswers, catalog: SaleCatalog, context: { turn: number; today: Date; leadValue: number | null }): ChatBlock[] {
  const { turn, today } = context;
  switch (saleAwaiting(answers, catalog)) {
    case "planType":
      return [{
        type: "question",
        id: `q-type-${turn}`,
        prompt: "Qual o tipo do plano?",
        choices: PLAN_TYPE_ORDER.map((type) => ({ id: `type-${type}`, label: PLAN_TYPE_LABEL[type], action: local("planType", type), hint: type === "familiar" ? "Titular e dependentes" : type === "pme" ? "Empresa pequena, CNPJ" : undefined })),
      }];
    case "ages":
      return [{
        type: "assistant",
        id: `a-ages-${turn}`,
        text: answers.planType === "individual"
          ? "Qual a idade do titular? Escreva aqui embaixo."
          : "Quais as idades? O titular primeiro, depois os dependentes, separando por vírgula. Ex.: 35, 32, 8",
      }];
    case "carrier": {
      const carriers = carriersFor(catalog, answers.planType);
      return [
        ...(carriers.length ? [] : [{ type: "assistant" as const, id: `a-no-carriers-${turn}`, text: "A corretora ainda não tem operadoras cadastradas no catálogo. Toque em Outra operadora para seguir; a direção completa depois." }]),
        {
        type: "question",
        id: `q-carrier-${turn}`,
        prompt: "Qual a operadora?",
        choices: [
          ...carriers.map((carrier) => ({ id: `carrier-${carrier.id}`, label: carrier.name, action: local("carrier", carrier.id) })),
          { id: "carrier-none", label: "Outra operadora", hint: "Fora do catálogo", action: local("carrier", "") },
        ],
      }];
    }
    case "plan": {
      const plans = plansFor(catalog, answers.carrierId, answers.planType);
      return [{
        type: "question",
        id: `q-plan-${turn}`,
        prompt: "E qual plano?",
        choices: [
          ...plans.map((plan) => ({ id: `plan-${plan.id}`, label: plan.name, hint: PLAN_TYPE_LABEL[plan.type], action: local("plan", plan.id) })),
          { id: "plan-none", label: "Não está na lista", action: local("plan", "") },
        ],
      }];
    }
    case "value":
      return context.leadValue
        ? [
          { type: "assistant", id: `a-value-${turn}`, text: "Qual o valor mensal fechado, somando todas as vidas? Escreva aqui embaixo ou use o valor da negociação." },
          { type: "question", id: `q-value-${turn}`, prompt: "Valor da negociação", choices: [{ id: "value-lead", label: money(context.leadValue), hint: "Usar este", action: local("value", String(context.leadValue)) }] },
        ]
        : [{ type: "assistant", id: `a-value-${turn}`, text: "Qual o valor mensal fechado, somando todas as vidas? Ex.: 1.250,90" }];
    case "start":
      return [{
        type: "question",
        id: `q-start-${turn}`,
        prompt: "Quando começa a vigência?",
        choices: [
          ...startOptions(today).map((option) => ({ id: `start-${option.key}`, label: option.label, hint: option.hint, action: local("start", option.key) })),
          { id: "start-other", label: "Outra data", action: local("startOther", "1") },
        ],
      }];
    case "done":
      return reviewBlocks(answers, catalog, turn);
  }
}

export function saleReviewRows(answers: SaleAnswers, catalog: SaleCatalog) {
  const carrier = catalog.carriers.find((item) => item.id === answers.carrierId);
  const plan = carrier?.plans.find((item) => item.id === answers.planId);
  return [
    { label: "Tipo", value: answers.planType ? PLAN_TYPE_LABEL[answers.planType] : "A informar" },
    { label: "Vidas", value: answers.ages?.length ? livesLine(answers.ages) : "A informar" },
    { label: "Operadora", value: carrier?.name ?? "Fora do catálogo" },
    { label: "Plano", value: plan?.name ?? "Fora do catálogo" },
    { label: "Valor mensal", value: answers.monthlyValue ? money(answers.monthlyValue) : "A informar" },
    { label: "Início da vigência", value: answers.coverageStartDate ? dateLabel(answers.coverageStartDate) : "A informar" },
  ];
}

export type SaleReviewData = {
  fromContract: boolean;
  contractName: string | null;
  sections: Array<{ title: string; rows: Array<{ label: string; value: string; sourced: boolean }> }>;
};

/** O resumo para confirmar, em três grupos (pessoas, plano, contrato), com a marca do que veio do contrato. */
export function saleReviewData(answers: SaleAnswers, catalog: SaleCatalog): SaleReviewData {
  const sourced = new Set(answers.sourced ?? []);
  const carrier = catalog.carriers.find((item) => item.id === answers.carrierId);
  const plan = carrier?.plans.find((item) => item.id === answers.planId);
  const people = answers.people?.length === answers.ages?.length ? answers.people ?? [] : [];
  const peopleRows = people.length
    ? people.map((person, index) => ({
      label: index === 0 ? "Titular" : RELATIONSHIP_LABEL[person.relationship],
      value: [person.name ?? (index === 0 ? "Titular" : `Dependente ${index}`), person.age != null ? `${person.age} anos` : null].filter(Boolean).join(", "),
      sourced: sourced.has("people"),
    }))
    : [{ label: "Vidas", value: answers.ages?.length ? livesLine(answers.ages) : "A informar", sourced: sourced.has("people") }];
  const contractRows = [
    ...(answers.policyNumber ? [{ label: "Apólice ou proposta", value: answers.policyNumber, sourced: sourced.has("policy") }] : []),
    ...(answers.paymentMethod ? [{ label: "Pagamento", value: PAYMENT_LABEL[answers.paymentMethod], sourced: sourced.has("payment") }] : []),
    { label: "Início da vigência", value: answers.coverageStartDate ? dateLabel(answers.coverageStartDate) : "A informar", sourced: sourced.has("start") },
    // Sem prazo no contrato vale o padrão de 12 meses: não é algo que o corretor informou.
    { label: "Prazo", value: answers.contractTermMonths ? `${answers.contractTermMonths} meses` : "12 meses (padrão)", sourced: sourced.has("term") || !answers.contractTermMonths },
  ];
  return {
    fromContract: Boolean(answers.fromContract),
    contractName: answers.contract?.filename ?? null,
    sections: [
      { title: "Pessoas", rows: peopleRows },
      {
        title: "Plano",
        rows: [
          { label: "Tipo", value: answers.planType ? PLAN_TYPE_LABEL[answers.planType] : "A informar", sourced: sourced.has("planType") },
          { label: "Operadora", value: carrier?.name ?? "Fora do catálogo", sourced: sourced.has("carrier") },
          { label: "Plano", value: plan?.name ?? "Fora do catálogo", sourced: sourced.has("plan") },
          { label: "Valor mensal", value: answers.monthlyValue ? money(answers.monthlyValue) : "A informar", sourced: sourced.has("value") },
        ],
      },
      { title: "Contrato", rows: contractRows },
    ],
  };
}

export function reviewBlocks(answers: SaleAnswers, catalog: SaleCatalog, turn: number): ChatBlock[] {
  return [
    { type: "custom", id: `review-${turn}`, kind: "review", data: saleReviewData(answers, catalog) },
    {
      type: "question",
      id: `q-confirm-${turn}`,
      prompt: "Tudo certo?",
      choices: [
        { id: "confirm", label: "Registrar venda", action: local("confirm", "1") },
        { id: "fix", label: "Corrigir algo", action: local("fix", "1") },
      ],
    },
  ];
}

export function fixBlocks(turn: number): ChatBlock[] {
  return [{
    type: "question",
    id: `q-fix-${turn}`,
    prompt: "O que você quer corrigir?",
    choices: [
      { id: "fix-type", label: "Tipo e vidas", action: local("reset", "type") },
      { id: "fix-carrier", label: "Operadora e plano", action: local("reset", "carrier") },
      { id: "fix-value", label: "Valor", action: local("reset", "value") },
      { id: "fix-start", label: "Vigência", action: local("reset", "start") },
    ],
  }];
}

/** Apaga o trecho a corrigir: a conversa pergunta só aquilo de novo. */
export function resetSaleAnswers(answers: SaleAnswers, part: string): SaleAnswers {
  const next = { ...answers };
  const drop = (...fields: SaleField[]) => { next.sourced = (next.sourced ?? []).filter((field) => !fields.includes(field)); };
  if (part === "type") { delete next.planType; delete next.ages; delete next.people; drop("planType", "people"); }
  if (part === "carrier") { delete next.carrierId; delete next.planId; drop("carrier", "plan"); }
  if (part === "value") { delete next.monthlyValue; drop("value"); }
  if (part === "start") { delete next.coverageStartDate; drop("start"); }
  return next;
}

/** Uma resposta tocada. null quando não vale para a pergunta em aberto. */
export function applySaleChoice(answers: SaleAnswers, value: string, catalog: SaleCatalog): SaleAnswers | null {
  const [field, raw] = splitSaleChoice(value);
  const awaiting = saleAwaiting(answers, catalog);
  if (field === "planType" && awaiting === "planType" && raw in PLAN_TYPE_LABEL) {
    const planType = raw as SalePlanType;
    // Trocou para individual com várias idades: as idades são perguntadas de novo.
    const ages = planType === "individual" && (answers.ages?.length ?? 0) > 1 ? undefined : answers.ages;
    return { ...answers, planType, ages };
  }
  if (field === "carrier" && awaiting === "carrier") {
    if (!raw) return { ...answers, carrierId: null, planId: null };
    return catalog.carriers.some((carrier) => carrier.id === raw) ? { ...answers, carrierId: raw, planId: undefined } : null;
  }
  if (field === "plan" && awaiting === "plan") {
    if (!raw) return { ...answers, planId: null };
    return plansFor(catalog, answers.carrierId, answers.planType).some((plan) => plan.id === raw) ? { ...answers, planId: raw } : null;
  }
  if (field === "value" && awaiting === "value") {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? { ...answers, monthlyValue: value, planId: answers.planId ?? null } : null;
  }
  if (field === "start" && awaiting === "start" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ...answers, coverageStartDate: raw };
  return null;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Nome lido do contrato (ou escrito) → item do catálogo: igual, ou um contém o outro. */
export function matchByName<T extends { name: string }>(items: T[], name: string | null | undefined): T | null {
  if (!name) return null;
  const target = normalize(name);
  if (!target) return null;
  return items.find((item) => normalize(item.name) === target)
    ?? items.find((item) => {
      const own = normalize(item.name);
      return own.length >= 3 && (target.includes(own) || own.includes(target));
    })
    ?? null;
}

/** O que a IA leu do contrato (tudo opcional). */
export type SaleContractReading = {
  planType?: SalePlanType | null;
  ages?: number[] | null;
  carrierName?: string | null;
  planName?: string | null;
  monthlyValue?: number | null;
  coverageStartDate?: string | null;
  holder?: SalePerson | null;
  dependents?: SalePerson[] | null;
  policyNumber?: string | null;
  paymentMethod?: SalePaymentMethod | null;
  contractTermMonths?: number | null;
};

/** Uma linha do cartão "Li do contrato": o que foi achado (ou não) em cada campo. */
export type ExtractedRow = { key: string; label: string; value: string | null };

/** Idade em anos completos numa data. */
export function ageOn(birthDate: string, today: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function firstNames(names: string[]) {
  const short = names.map((name) => name.split(" ")[0]);
  return short.length <= 1 ? short.join("") : `${short.slice(0, -1).join(", ")} e ${short[short.length - 1]}`;
}

/** Junta o que foi lido do contrato às respostas: o que não foi achado continua para perguntar. */
export function mergeContractReading(answers: SaleAnswers, reading: SaleContractReading, catalog: SaleCatalog, today = new Date()): { answers: SaleAnswers; found: string[]; rows: ExtractedRow[] } {
  const next: SaleAnswers = { ...answers, fromContract: true };
  const sourced = new Set<SaleField>(answers.sourced ?? []);
  const found: string[] = [];

  const people = [reading.holder ? { ...reading.holder, relationship: "titular" as const } : null, ...(reading.dependents ?? [])]
    .filter((person): person is SalePerson => Boolean(person))
    .map((person) => ({ ...person, age: person.age ?? (person.birthDate ? ageOn(person.birthDate, today) : null) }))
    .slice(0, 30);
  if (people.length && people.every((person) => person.age != null)) {
    next.people = people;
    next.ages = people.map((person) => person.age!);
  } else {
    const ages = (reading.ages ?? []).filter((age) => Number.isInteger(age) && age >= 0 && age <= 120).slice(0, 30);
    if (ages.length) next.ages = ages;
    if (people.length) next.people = people;
  }
  if (next.ages?.length) { sourced.add("people"); found.push(next.ages.length === 1 ? "a idade do titular" : `${next.ages.length} vidas`); }

  if (reading.planType && reading.planType in PLAN_TYPE_LABEL) { next.planType = reading.planType; sourced.add("planType"); found.unshift(`tipo ${PLAN_TYPE_LABEL[reading.planType]}`); }
  else if (next.ages?.length && !next.planType) next.planType = next.ages.length > 1 ? "familiar" : "individual";

  const carrier = matchByName(catalog.carriers, reading.carrierName);
  if (carrier) {
    next.carrierId = carrier.id;
    sourced.add("carrier");
    found.push(carrier.name);
    const plan = matchByName(carrier.plans, reading.planName);
    if (plan) { next.planId = plan.id; sourced.add("plan"); found.push(`plano ${plan.name}`); } else delete next.planId;
  }
  if (reading.monthlyValue && reading.monthlyValue > 0 && reading.monthlyValue <= 1_000_000) {
    next.monthlyValue = Math.round(reading.monthlyValue * 100) / 100;
    sourced.add("value");
    found.push(`valor ${money(next.monthlyValue)}`);
  }
  if (reading.coverageStartDate && /^\d{4}-\d{2}-\d{2}$/.test(reading.coverageStartDate)) {
    next.coverageStartDate = reading.coverageStartDate;
    sourced.add("start");
    found.push(`vigência em ${dateLabel(reading.coverageStartDate)}`);
  }
  if (reading.policyNumber) { next.policyNumber = reading.policyNumber; sourced.add("policy"); }
  if (reading.paymentMethod && reading.paymentMethod in PAYMENT_LABEL) { next.paymentMethod = reading.paymentMethod; sourced.add("payment"); }
  if (reading.contractTermMonths && reading.contractTermMonths >= 1 && reading.contractTermMonths <= 120) { next.contractTermMonths = reading.contractTermMonths; sourced.add("term"); }
  next.sourced = [...sourced];

  const holder = next.people?.find((person) => person.relationship === "titular");
  const dependents = next.people?.filter((person) => person.relationship !== "titular") ?? [];
  const namedDependents = dependents.map((person) => person.name).filter((name): name is string => Boolean(name));
  const plan = carrier?.plans.find((item) => item.id === next.planId);
  const rows: ExtractedRow[] = [
    { key: "holder", label: "Titular", value: holder?.name ? `${holder.name}${holder.age != null ? `, ${holder.age} anos` : ""}` : next.ages?.length ? `${next.ages[0]} anos` : null },
    { key: "dependents", label: "Dependentes", value: namedDependents.length ? `${dependents.length}: ${firstNames(namedDependents)}` : next.ages && next.ages.length > 1 ? `${next.ages.length - 1} (${next.ages.slice(1).join(", ")} anos)` : next.ages?.length === 1 ? "Nenhum" : null },
    { key: "carrier", label: "Operadora", value: carrier?.name ?? reading.carrierName ?? null },
    { key: "plan", label: "Plano", value: plan?.name ?? reading.planName ?? null },
    { key: "value", label: "Valor mensal", value: next.monthlyValue && sourced.has("value") ? money(next.monthlyValue) : null },
    { key: "start", label: "Vigência", value: sourced.has("start") && next.coverageStartDate ? dateLabel(next.coverageStartDate) : null },
    { key: "policy", label: "Apólice ou proposta", value: next.policyNumber ?? null },
    { key: "payment", label: "Pagamento", value: next.paymentMethod ? PAYMENT_LABEL[next.paymentMethod] : null },
  ];
  return { answers: next, found, rows };
}

/** Escreveu em vez de tocar: tenta casar o texto com a pergunta em aberto. */
export function applySaleText(answers: SaleAnswers, text: string, catalog: SaleCatalog, today: Date): { answers: SaleAnswers } | { error: string } {
  const awaiting = saleAwaiting(answers, catalog);
  if (awaiting === "ages") {
    const parsed = parseSaleAges(text, answers.planType);
    return "error" in parsed ? parsed : { answers: { ...answers, ages: parsed.ages, people: undefined } };
  }
  if (awaiting === "value") {
    const parsed = parseSaleMoney(text);
    return "error" in parsed ? parsed : { answers: { ...answers, monthlyValue: parsed.value, planId: answers.planId ?? null } };
  }
  if (awaiting === "start") {
    const parsed = parseSaleDate(text, today);
    return "error" in parsed ? parsed : { answers: { ...answers, coverageStartDate: parsed.date } };
  }
  if (awaiting === "planType") {
    const type = PLAN_TYPE_ORDER.find((item) => normalize(text).includes(normalize(PLAN_TYPE_LABEL[item])));
    return type ? { answers: { ...answers, planType: type } } : { error: "Toque em um dos tipos acima." };
  }
  if (awaiting === "carrier") {
    const carrier = matchByName(catalog.carriers, text);
    return carrier ? { answers: { ...answers, carrierId: carrier.id, planId: undefined } } : { error: "Não achei essa operadora no catálogo. Toque em uma acima ou em Outra operadora." };
  }
  if (awaiting === "plan") {
    const plan = matchByName(plansFor(catalog, answers.carrierId, answers.planType), text);
    return plan ? { answers: { ...answers, planId: plan.id } } : { error: "Não achei esse plano. Toque em um acima ou em Não está na lista." };
  }
  return { error: "Use as opções acima para seguir." };
}
