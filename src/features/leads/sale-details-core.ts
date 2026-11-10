import { z } from "zod";

import { maskPersonalData } from "@/features/ai-gateway/privacy";

export const SALE_DETAILS_AI_FIELDS = [
  "holderBirthDate",
  "holderAge",
  "livesCount",
  "dependentAges",
  "dependentDetails",
  "operator",
  "plan",
  "monthlyValue",
  "enrollmentValue",
  "firstInstallmentValue",
  "paymentMethod",
  "paymentDate",
  "proposalNumber",
  "medicalInterviewDate",
] as const;

export const SALE_DETAILS_STORED_FIELDS = SALE_DETAILS_AI_FIELDS;

const SaleDetailsProvenanceSchema = z.object({
  source: z.enum(["IA", "CRM", "Conversa", "Proposta", "Venda registrada"]).optional(),
  requiresConfirmation: z.boolean().optional(),
  evidenceAt: z.string().datetime().optional(),
  evidenceMessageId: z.string().max(128).optional(),
  evidenceSender: z.enum(["Cliente", "Corretor"]).optional(),
});

export const SaleDetailsStoredFieldSchema = z.object({
  field: z.enum(SALE_DETAILS_STORED_FIELDS),
  value: z.string().trim().min(1).max(400),
  evidenceQuote: z.string().trim().max(400).optional(),
  ...SaleDetailsProvenanceSchema.shape,
});

export const SaleDetailsAiFieldSchema = z.object({
  field: z.enum(SALE_DETAILS_AI_FIELDS),
  value: z.string().trim().min(1).max(400),
  evidenceQuote: z.string().trim().min(3).max(400),
});

export const SaleDetailsStoredSchema = z.object({
  fields: z.array(SaleDetailsStoredFieldSchema).max(14).default([]),
});

export const SaleDetailsAiSchema = z.object({
  fields: z.array(SaleDetailsAiFieldSchema).max(14).default([]),
});

export type SaleDetailsAiField = z.infer<typeof SaleDetailsStoredFieldSchema>;
export type SaleDetailsAiData = z.infer<typeof SaleDetailsStoredSchema>;

export type SaleDetailsTranscriptMessage = {
  id: string;
  sender: "customer" | "broker" | "system";
  content: string;
  timestamp: Date;
};

const SALE_DETAIL_SIGNAL = /\b(plano|operadora|conv[eê]nio|vidas?|dependentes?|funcion[aá]rios?|idades?|anos?|nascimento|nasci|cpf|ades[aã]o|mensalidade|parcela|pag(?:uei|amento|ar)|pix|boleto|proposta|ap[oó]lice|carteirinha|entrevista|video ?chamada|documento|comprovante|contrato|cota[cç][aã]o|c[aá]lculo|valor|pre[cç]o|entrada)\b/i;

/**
 * Scans the full conversation but sends only lines that may contain sale facts,
 * plus one adjacent line for context. Old facts therefore remain discoverable
 * without repeatedly sending unrelated chat history to the model.
 */
export function buildSaleDetailsTranscript(messages: readonly SaleDetailsTranscriptMessage[]): string {
  if (!messages.length) return "Nenhuma mensagem registrada.";
  const chronological = [...messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const relevantIndexes = new Set<number>();
  chronological.forEach((message, index) => {
    if (message.sender !== "system" && SALE_DETAIL_SIGNAL.test(message.content)) {
      relevantIndexes.add(index);
      if (index > 0 && chronological[index - 1]?.sender !== "system") relevantIndexes.add(index - 1);
      if (index + 1 < chronological.length && chronological[index + 1]?.sender !== "system") relevantIndexes.add(index + 1);
    }
  });

  const lines = [...relevantIndexes].sort((a, b) => a - b).map((index) => {
    const message = chronological[index]!;
    const who = message.sender === "customer" ? "Cliente" : message.sender === "broker" ? "Corretor" : "Sistema";
    const when = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(message.timestamp);
    // Mask here as well as in the gateway so evidence validation uses the exact
    // privacy-safe text the model saw. CPF is extracted separately server-side.
    return `[${when}] ${who}: ${maskPersonalData(message.content.trim())}`;
  });

  return lines.join("\n") || "Nenhuma mensagem com dados comerciais registrada.";
}

export function validateAndMergeSaleDetails(input: {
  previous: unknown;
  extracted: unknown;
  messages: readonly SaleDetailsTranscriptMessage[];
}): SaleDetailsAiData {
  const previous = SaleDetailsStoredSchema.safeParse(input.previous);
  const rawFields = input.extracted && typeof input.extracted === "object" && !Array.isArray(input.extracted)
    ? (input.extracted as { fields?: unknown }).fields
    : null;
  const fields = new Map<string, SaleDetailsAiField>();

  if (previous.success) {
    for (const field of previous.data.fields) {
      fields.set(field.field, { ...field, value: maskPersonalData(field.value) });
    }
  }

  if (Array.isArray(rawFields)) {
    const chronological = [...input.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const rawField of rawFields) {
      const parsedField = SaleDetailsAiFieldSchema.safeParse(rawField);
      if (!parsedField.success) continue;
      const field = parsedField.data;
      const quote = maskPersonalData(field.evidenceQuote.trim());
      const match = chronological.find((message) => message.sender !== "system" && maskPersonalData(message.content).includes(quote));
      if (!match) continue;
      fields.set(field.field, {
        ...field,
        value: maskPersonalData(field.value),
        evidenceQuote: quote,
        source: "IA",
        requiresConfirmation: true,
        evidenceAt: match.timestamp.toISOString(),
        evidenceMessageId: match.id,
        evidenceSender: match.sender === "customer" ? "Cliente" : "Corretor",
      });
    }
  }

  return SaleDetailsStoredSchema.parse({ fields: [...fields.values()] });
}

export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^([\d])\1{10}$/.test(digits)) return false;
  const calculateDigit = (base: string, factor: number) => {
    const sum = [...base].reduce((total, digit) => total + Number(digit) * factor--, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(digits.slice(0, 9), 10) === Number(digits[9])
    && calculateDigit(digits.slice(0, 10), 11) === Number(digits[10]);
}

export function extractCpfFromText(value: string): string | null {
  const candidates = value.match(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g) ?? [];
  const valid = candidates.find(isValidCpf);
  if (!valid) return null;
  const digits = valid.replace(/\D/g, "");
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function extractCpfFromMessages(messages: readonly Pick<SaleDetailsTranscriptMessage, "content">[]): string | null {
  for (const message of messages) {
    const cpf = extractCpfFromText(message.content);
    if (cpf) return cpf;
  }
  return null;
}

export function extractCpfFromSources(...sources: unknown[]): string | null {
  const visit = (value: unknown, key = "", depth = 0): string | null => {
    if (depth > 4 || value == null) return null;
    if (typeof value === "string") return /cpf|documentoTitular/i.test(key) ? extractCpfFromText(value) : null;
    if (Array.isArray(value)) {
      for (const item of value) {
        const cpf = visit(item, key, depth + 1);
        if (cpf) return cpf;
      }
      return null;
    }
    if (typeof value !== "object") return null;
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      const cpf = visit(childValue, childKey, depth + 1);
      if (cpf) return cpf;
    }
    return null;
  };
  for (const source of sources) {
    const cpf = visit(source);
    if (cpf) return cpf;
  }
  return null;
}

export function maskCpf(value: string | null | undefined, reveal: boolean): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return reveal ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : `***.***.***-${digits.slice(9)}`;
}

export function ageOnDate(birthDate: string | Date, today = new Date()): number | null {
  const birth = birthDate instanceof Date ? birthDate : new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth > today) return null;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function canViewSaleDetails(input: {
  role: string;
  userId: string;
  branchId: string | null;
  leadBranchId: string | null;
  leadOwnerId: string | null;
}): boolean {
  if (input.role === "director") return true;
  if (input.role === "manager") return Boolean(input.branchId && input.leadBranchId === input.branchId);
  if (input.role === "broker") return Boolean(input.leadOwnerId && input.leadOwnerId === input.userId);
  return false;
}

export function shouldShowSaleDetailsCard(status: string, hasSaleEvidence: boolean): boolean {
  return ["documentation_pending", "under_analysis", "converted"].includes(status) || hasSaleEvidence;
}

export function hasConfirmedSaleEvidence(value: unknown): boolean {
  return value === "confirmed";
}
