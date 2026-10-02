import { readMetaLeadDisplayDetails } from "./meta-lead-display";

/**
 * Everything the client told us, in one place: the AI qualification (what the
 * client said in the conversation), the Meta form (plan, CNPJ type, carrier
 * and every other answer) and the lead's own contact data. Used by the lead
 * page (lite) and by the offer sent to the broker for acceptance.
 */
export type LeadClientInfoItem = { key: string; label: string; value: string };

export type LeadClientInfoInput = {
  email?: string | null;
  tipo?: string | null;
  sourceChannel?: string | null;
  sourceMetadata?: unknown;
  qualificationDetails?: unknown;
  formData?: unknown;
};

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {});

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 300) : null;
}

/** Values the AI kept in its memory, e.g. memory.intent.value. */
function memoryValues(details: Json): Json {
  const context = asRecord(details.aiQualificationContext);
  const memory = asRecord(context.memory);
  return Object.fromEntries(Object.entries(memory).map(([key, entry]) => [key, asRecord(entry).value ?? (typeof entry === "string" ? entry : null)]));
}

const PLAN_LABELS: Record<string, string> = { individual: "Individual", familiar: "Familiar", pme: "Empresarial (PME)", empresarial: "Empresarial (PME)", pj: "Empresarial (PJ)", adesao: "Adesão" };

/** Labels of AI memory fields shown besides the main ones (unknown keys get a readable fallback). */
const MEMORY_LABELS: Record<string, string> = {
  intent: "Interesse",
  hasCnpj: "Tem CNPJ",
  companyName: "Empresa",
  cnpj: "CNPJ",
  employees: "Funcionários",
  currentPlan: "Plano atual",
  currentCarrier: "Operadora atual",
  preferredCarrier: "Operadora de preferência",
  budget: "Orçamento",
  neighborhood: "Bairro",
  state: "Estado",
  profession: "Profissão",
  urgency: "Urgência",
  bestContactTime: "Melhor horário",
  hospital: "Hospital de preferência",
  observations: "Observações",
};
/** Shown by the main fields, or not client information. */
const MEMORY_SKIP = new Set(["age", "city", "email", "planType", "numberOfLives", "customerName", "customerFirstName", "collectedFields", "updatedAt"]);

function readableKey(key: string) {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function buildLeadClientInfo(input: LeadClientInfoInput): LeadClientInfoItem[] {
  const details = asRecord(input.qualificationDetails);
  const memory = memoryValues(details);
  const meta = readMetaLeadDisplayDetails(input.sourceChannel, input.sourceMetadata);
  const metadata = asRecord(input.sourceMetadata);
  const form = asRecord(input.formData);
  const items: LeadClientInfoItem[] = [];
  const push = (key: string, label: string, value: unknown) => {
    const v = text(value);
    if (v && !items.some((item) => item.key === key)) items.push({ key, label, value: v });
  };

  const planType = text(details.planType) ?? text(memory.planType) ?? meta.tipoPlano;
  push("planType", "Tipo de plano", planType ? PLAN_LABELS[planType.toLowerCase()] ?? planType : null);
  push("lives", "Vidas", details.numberOfLives ?? memory.numberOfLives ?? form.qtdVidas ?? form.vidas ?? form.dependentes);
  const ages = text(details.individualAges) ?? text(memory.age);
  push("ages", "Idades", ages ?? (text(details.averageAge) ? `média de ${text(details.averageAge)} anos` : form.mediaIdades));
  push("city", "Cidade", details.city ?? memory.city ?? form.cidade ?? form.city);
  push("email", "E-mail", input.email ?? details.email ?? memory.email);
  push("tipoCnpj", "Tipo de CNPJ", meta.tipoCnpj);
  push("operadora", "Operadora de preferência", meta.operadora);

  for (const [key, value] of Object.entries(memory)) {
    if (MEMORY_SKIP.has(key)) continue;
    push(`memory:${key}`, MEMORY_LABELS[key] ?? readableKey(key), value);
  }

  // Every other answer of the Meta form, as "Pergunta: resposta".
  const answers = Array.isArray(metadata.formAnswers) ? metadata.formAnswers : [];
  for (const answer of answers) {
    const entry = text(answer);
    if (!entry) continue;
    const split = entry.indexOf(": ");
    if (split > 0) push(`form:${entry.slice(0, split)}`, entry.slice(0, split), entry.slice(split + 2));
  }

  // Legacy form fields kept in formData (manual/webhook leads).
  const FORM_LABELS: Record<string, string> = { razaoSocial: "Razão social", cnpj: "CNPJ", funcionarios: "Funcionários", bairro: "Bairro", profissao: "Profissão", observacoes: "Observações", produtoInteresse: "Interesse" };
  for (const [key, value] of Object.entries(form)) {
    if (["qtdVidas", "vidas", "dependentes", "mediaIdades", "cidade", "city"].includes(key)) continue;
    push(`formData:${key}`, FORM_LABELS[key] ?? readableKey(key), value);
  }

  return items;
}

/**
 * One line for the offer template ("Produto de interesse"): plan, lives, ages,
 * city and interest. Meta rejects line breaks, tabs and 4+ spaces in a
 * parameter, so it is a single, short line.
 */
export function buildLeadOfferSummary(input: LeadClientInfoInput, fallback: string): string {
  const items = buildLeadClientInfo(input);
  const get = (key: string) => items.find((item) => item.key === key)?.value ?? null;
  const lives = get("lives");
  const parts = [
    get("planType") ?? fallback,
    lives ? `${lives} ${lives === "1" ? "vida" : "vidas"}` : null,
    get("ages") ? `idades ${get("ages")}` : null,
    get("city"),
    get("tipoCnpj") ? `CNPJ ${get("tipoCnpj")}` : null,
    get("memory:intent") ? `interesse: ${get("memory:intent")}` : null,
  ].filter(Boolean);
  return parts.join(" · ").replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").slice(0, 240);
}
