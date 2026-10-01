import { createEmptyMemory, extractFieldsFromMessage, readAgeList, type ConversationMemory } from "./memory";

export type QualificationCorrection = { field: "numberOfLives" | "age" | "averageAge" | "email"; value: string };

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
  const isCorrection = CORRECTION_SIGNAL.test(normalized) || /\b\d{1,2}\s*(?:vidas?|pessoas?)\b/.test(normalized);
  if (isCorrection) {
    const fresh = extractFieldsFromMessage(message, { ...createEmptyMemory(), planType: memory.planType });
    const ages = readAgeList(message).filter((age) => age > 0);
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
