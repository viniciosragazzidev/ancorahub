import { hasCoreQuoteData, type ConversationMemory, type MemoryField } from "./memory";

export type QualificationTimeoutMessage = {
  id: string;
  messageId: string | null;
  direction: string;
  senderRole: string | null;
  body: string;
  sentAt: Date;
};

export type QualificationTimeoutOutcome = {
  qualificationStatus: "hot" | "warm" | "cold";
  qualificationState: "PARTIAL";
};

const invalidAnswers = new Set([
  "",
  "0",
  "nenhuma",
  "nenhum",
  "nenhuma das opcoes",
  "nenhum dos dois",
  "nao",
  "nao sei",
  "prefiro nao informar",
  "nao informado",
  "n/a",
]);

const qualificationFields = [
  "customerName",
  "city",
  "state",
  "age",
  "birthDate",
  "planType",
  "numberOfLives",
  "companyHasCnpj",
  "averageAge",
  "intent",
  "email",
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isInbound(message: QualificationTimeoutMessage) {
  return ["incoming", "inbound"].includes(message.direction.toLowerCase())
    || (message.senderRole === "user" && !["outbound", "outgoing"].includes(message.direction.toLowerCase()));
}

function isOutboundQuestion(message: QualificationTimeoutMessage) {
  return (["outbound", "outgoing"].includes(message.direction.toLowerCase()) || message.senderRole === "assistant")
    && message.body.includes("?");
}

function hasValidFieldValue(key: (typeof qualificationFields)[number], field: MemoryField | undefined) {
  if (!field || field.confidence !== 1 || typeof field.value !== "string") return false;
  const value = field.value.trim();
  const normalized = normalize(value);
  if (invalidAnswers.has(normalized)) return false;

  switch (key) {
    case "numberOfLives": {
      const count = Number(normalized);
      return Number.isInteger(count) && count > 0 && count < 100;
    }
    case "age":
    case "averageAge": {
      const age = Number(normalized.replace(",", "."));
      return Number.isFinite(age) && age >= 0 && age <= 120;
    }
    case "planType":
      return ["individual", "familiar", "empresarial"].includes(normalized);
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "customerName":
      return value.length >= 4 && /\p{L}/u.test(value) && !/^(sim|nao|nenhuma|nenhum)$/i.test(normalized);
    case "city":
      return value.length >= 3 && /\p{L}/u.test(value) && !/^(sim|nao|nenhuma|nenhum|ok)$/i.test(normalized);
    case "state":
      return /^[\p{L} .'-]{2,40}$/u.test(value) && !/^(sim|nao|nenhuma|nenhum)$/i.test(normalized);
    case "birthDate": {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    }
    case "companyHasCnpj":
      return ["true", "false", "sim", "nao", "possui", "nao possui"].includes(normalized);
    case "intent":
      return value.length >= 5 && !/^(sim|nao|nenhuma|nenhum|ok)$/i.test(normalized);
  }
}

function hasQuestionBeforeSource(
  sourceMessageId: string | undefined,
  messages: QualificationTimeoutMessage[],
) {
  if (!sourceMessageId) return false;
  const source = messages.find((message) =>
    isInbound(message) && (message.id === sourceMessageId || message.messageId === sourceMessageId),
  );
  if (!source) return false;

  return messages.some((message) =>
    isOutboundQuestion(message) && message.sentAt.getTime() < source.sentAt.getTime(),
  );
}

/** A lead is warm only when a qualification field came from a valid reply to a question. */
export function qualificationTimeoutOutcome(
  memory: ConversationMemory | null | undefined,
  messages: QualificationTimeoutMessage[],
): QualificationTimeoutOutcome {
  const hasValidReply = Boolean(memory) && qualificationFields.some((key) => {
    const field = memory?.[key] as MemoryField | undefined;
    return hasValidFieldValue(key, field) && hasQuestionBeforeSource(field?.sourceMessageId, messages);
  });

  // Stopped answering after giving plan type, lives and ages: still hot, never held (23/10).
  if (hasCoreQuoteData(memory)) return { qualificationStatus: "hot", qualificationState: "PARTIAL" };
  return {
    qualificationStatus: hasValidReply ? "warm" : "cold",
    qualificationState: "PARTIAL",
  };
}

export function qualificationTimeoutDistributionStatus(qualificationStatus: "hot" | "warm" | "cold") {
  return qualificationStatus === "cold" ? "manual_hold" as const : "queued" as const;
}

/** Manual re-open resets the SLA clock while a newer message still takes precedence. */
export function qualificationTimeoutAnchor(lastActivityAt: Date, reopenedAt?: Date | null) {
  return reopenedAt && reopenedAt.getTime() > lastActivityAt.getTime() ? reopenedAt : lastActivityAt;
}

export function hasQualificationTimedOut(input: {
  lastActivityAt: Date;
  reopenedAt?: Date | null;
  now: Date;
  timeoutMinutes: number;
}) {
  const anchor = qualificationTimeoutAnchor(input.lastActivityAt, input.reopenedAt);
  const timeoutMs = Math.max(1, input.timeoutMinutes) * 60_000;
  return input.now.getTime() - anchor.getTime() >= timeoutMs;
}
