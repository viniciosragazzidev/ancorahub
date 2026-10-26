import { createEmptyMemory, extractFieldsFromMessage, readAgeList, type ConversationMemory } from "./memory";
import { captureBeneficiaryRelations, parseAgeValues, type BeneficiaryRelationCapture } from "./beneficiary-relations";

export type QualificationCorrection = { field: "numberOfLives" | "age" | "averageAge" | "email"; value: string };

export function applyQualificationCorrectionsToMemory(input: {
  memory: ConversationMemory;
  corrections: QualificationCorrection[];
  message: string;
  sourceMessageId?: string | null;
}) {
  const memory: ConversationMemory = {
    ...input.memory,
    collectedFields: [...input.memory.collectedFields],
    updatedAt: new Date().toISOString(),
  };
  for (const correction of input.corrections) {
    (memory as Record<string, unknown>)[correction.field] = { value: correction.value, confidence: 1 };
    if (!memory.collectedFields.includes(correction.field)) memory.collectedFields.push(correction.field);
  }

  let beneficiaryCapture: BeneficiaryRelationCapture | undefined;
  const ageCorrected = input.corrections.some((correction) => correction.field === "age");
  const ages = parseAgeValues(memory.age?.value);
  if (ageCorrected && (memory.relationAsked || memory.beneficiaries?.length || memory.beneficiaryRaw)) {
    memory.beneficiaries = ages.map((age) => ({ age, relation: null, sourceMessageId: input.sourceMessageId ?? undefined }));
    memory.beneficiaryRaw = undefined;
  }

  if (memory.relationAsked && memory.planType?.value !== "empresarial" && ages.length >= 2) {
    const capture = captureBeneficiaryRelations({
      message: input.message,
      ages,
      planType: memory.planType?.value,
      sourceMessageId: input.sourceMessageId,
      relationAsked: true,
    });
    if (capture.status !== "unrecognized") {
      memory.beneficiaries = capture.beneficiaries;
      memory.beneficiaryRaw = capture.raw;
      beneficiaryCapture = capture;
    }
  }

  return { memory, beneficiaryCapture };
}

/** Words that turn a message into a correction ("Não, são 2 vidas"). */
const CORRECTION_SIGNAL = /\b(nao|errad[oa]|corrig\w*|na verdade|na real|desculp\w*|ops|engano|sao|seriam)\b/;

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * What a customer corrected after the qualification ended. Pure. People,
 * ages and average age change only when the message says it is a correction
 * (or counts people explicitly), so small talk is never read as new data; a
 * new e-mail is always taken.
 */
export function detectQualificationCorrections(memory: ConversationMemory, message: string): QualificationCorrection[] {
  const normalized = normalize(message);
  const corrections: QualificationCorrection[] = [];
  const ages = readAgeList(message).filter((age) => age > 0);
  const knownAges = parseAgeValues(memory.age?.value);
  const relatesToBeneficiaries = /\b(?:eu|meu|minha|meus|minhas|filh[oa]s?|conjuge|espos[ao]|marido|mulher|mae|pai|net[oa]s?)\b/.test(normalized);
  const correctedAgeListAfterRelationPrompt = memory.relationAsked
    && relatesToBeneficiaries
    && ages.length >= 2
    && ages.join(", ") !== knownAges.join(", ");
  const isCorrection = CORRECTION_SIGNAL.test(normalized)
    || /\b\d{1,2}\s*(?:vidas?|pessoas?)\b/.test(normalized)
    || correctedAgeListAfterRelationPrompt;
  if (isCorrection) {
    const fresh = extractFieldsFromMessage(message, { ...createEmptyMemory(), planType: memory.planType });
    if (fresh.numberOfLives?.value && fresh.numberOfLives.value !== memory.numberOfLives?.value) {
      corrections.push({ field: "numberOfLives", value: fresh.numberOfLives.value });
    }
    const agesText = ages.join(", ");
    if (agesText && agesText !== memory.age?.value) corrections.push({ field: "age", value: agesText });
    if (fresh.averageAge?.value && fresh.averageAge.value !== memory.averageAge?.value) {
      corrections.push({ field: "averageAge", value: fresh.averageAge.value });
    }
  }
  const email = message.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
  if (email && email.toLowerCase() !== memory.email?.value?.toLowerCase()) corrections.push({ field: "email", value: email });
  return corrections;
}

/** "2 vidas; idades 12, 42 (média 27)": the corrections as the customer and the broker read them. */
export function describeQualificationCorrections(corrections: QualificationCorrection[]) {
  const value = (field: QualificationCorrection["field"]) => corrections.find((correction) => correction.field === field)?.value;
  const parts: string[] = [];
  const lives = value("numberOfLives");
  if (lives) parts.push(`${lives} ${lives === "1" ? "vida" : "vidas"}`);
  const ages = value("age");
  const average = value("averageAge");
  if (ages) parts.push(`${ages.includes(",") ? "idades" : "idade"} ${ages}${average && ages.includes(",") ? ` (média ${average})` : ""}`);
  else if (average) parts.push(`idade média ${average}`);
  const email = value("email");
  if (email) parts.push(`e-mail ${email}`);
  return parts.join("; ");
}
