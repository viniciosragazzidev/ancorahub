import type { ConversationMemory } from "@/features/ai-agent/memory";

import { isCompanyLead, type ApproachInput } from "./approaches";

/**
 * What the ad form already answered goes into the conversation memory before
 * the first question, so the assistant never asks it again (plan §5, pilar C).
 * Only clear answers are used; anything doubtful stays for the conversation.
 */
const FORM_SOURCE = "lead_form";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function setField(memory: ConversationMemory, key: "planType" | "numberOfLives" | "city" | "companyHasCnpj", value: string) {
  if (memory[key]?.value) return;
  memory[key] = { value, confidence: 1, sourceMessageId: FORM_SOURCE };
  if (!memory.collectedFields.includes(key)) memory.collectedFields.push(key);
}

function planFromText(value: string): "individual" | "familiar" | "empresarial" | null {
  const text = normalize(value);
  if (!text) return null;
  if (/empresa|empresarial|pme|cnpj|\bmei\b|\bpj\b|juridica/.test(text)) return "empresarial";
  if (/famil|dependente|casal|filh|esposa|marido/.test(text)) return "familiar";
  if (/individual|so para mim|para mim|\bpf\b|pessoa fisica|so eu/.test(text)) return "individual";
  return null;
}

/** "Pergunta: resposta" entries from the Lead Ads form. */
function formAnswers(metadata: Record<string, unknown>) {
  const raw = metadata.formAnswers;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => {
      const index = entry.indexOf(":");
      return index > 0 ? { question: normalize(entry.slice(0, index)), answer: entry.slice(index + 1).trim() } : null;
    })
    .filter((entry): entry is { question: string; answer: string } => Boolean(entry?.answer));
}

export function seedMemoryFromLeadForm(memory: ConversationMemory, lead: ApproachInput): { memory: ConversationMemory; seeded: string[] } {
  const next: ConversationMemory = { ...memory, collectedFields: [...memory.collectedFields] };
  const before = new Set(next.collectedFields);
  const metadata = lead.sourceMetadata ?? {};

  if (isCompanyLead(lead)) {
    setField(next, "planType", "empresarial");
    if (typeof metadata.tipoCnpj === "string" && /cnpj|mei|sim|ativo|ltda|eireli|\bme\b/.test(normalize(metadata.tipoCnpj))) setField(next, "companyHasCnpj", "true");
  } else if (typeof metadata.tipoPlano === "string") {
    const plan = planFromText(metadata.tipoPlano);
    if (plan) setField(next, "planType", plan);
  }

  for (const { question, answer } of formAnswers(metadata)) {
    if (/vidas|pessoas|quantas|beneficiarios|dependentes/.test(question)) {
      const lives = Number(answer.match(/\d+/)?.[0]);
      if (Number.isInteger(lives) && lives > 0 && lives < 100) setField(next, "numberOfLives", String(lives));
    } else if (/cidade|municipio|onde mora|regiao/.test(question) && answer.length <= 60 && !/\d{3,}/.test(answer)) {
      setField(next, "city", answer.replace(/\s+/g, " "));
    } else if (/plano|para quem|tipo/.test(question)) {
      const plan = planFromText(answer);
      if (plan) setField(next, "planType", plan);
    }
  }

  if (next.planType?.value === "individual") setField(next, "numberOfLives", "1");
  const seeded = next.collectedFields.filter((key) => !before.has(key));
  if (seeded.length) next.updatedAt = new Date().toISOString();
  return { memory: next, seeded };
}
