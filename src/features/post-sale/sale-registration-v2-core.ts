export type LeadIdentitySources = {
  qualificationDetails?: unknown;
  formData?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findIdentityValue(formData: unknown, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  // These keys are the titular's identity fields in the lead form. Do not walk
  // nested objects or analysis fields: those can contain a dependent's CPF/age.
  for (const [key, entry] of Object.entries(asRecord(formData))) {
    if (normalizedKeys.has(normalizeKey(key)) && (typeof entry === "string" || typeof entry === "number")) {
      const candidate = String(entry).trim();
      if (candidate) return candidate;
    }
  }
  return null;
}

export function parseIdentityBirthDate(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const brazilian = value.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  if (!brazilian) return null;
  const [, day, month, year] = brazilian;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
    ? null
    : `${year}-${month}-${day}`;
}

export function deriveAgeFromBirthDate(birthDate: string, now = new Date()): number | null {
  const date = new Date(`${birthDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const birthdayHasPassed = now.getUTCMonth() > date.getUTCMonth()
    || (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() >= date.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

export function leadIdentityFromSources(sources: LeadIdentitySources, now = new Date()) {
  const birthDate = parseIdentityBirthDate(findIdentityValue(sources.formData, ["birthDate", "dataNascimento", "nascimento", "holderBirthDate"]));
  const ageRaw = findIdentityValue(sources.formData, ["age", "idade", "holderAge"]);
  const parsedAgeText = ageRaw?.match(/\b(\d{1,3})\b/)?.[1] ?? null;
  const parsedAge = parsedAgeText ? Number(parsedAgeText) : null;
  const age = birthDate ? deriveAgeFromBirthDate(birthDate, now) : parsedAge !== null && parsedAge <= 120 ? parsedAge : null;
  const cpfRaw = findIdentityValue(sources.formData, ["cpf", "holderCpf", "titularCpf", "cpfTitular"]);
  const cpfDigits = cpfRaw?.replace(/\D/g, "") ?? "";
  return {
    birthDate,
    age,
    cpf: cpfDigits.length === 11 ? cpfDigits : null,
  };
}

export function canUseSaleRegistrationV2(input: {
  enabled: boolean;
  isLiteBroker: boolean;
  isCurrentBroker: boolean;
  status: string;
  aiSaleRegistrationPending: boolean;
  hasActiveSale: boolean;
}) {
  if (!input.enabled || !input.isLiteBroker || !input.isCurrentBroker || input.hasActiveSale) return false;
  if (input.status === "lost") return false;
  if (input.status === "converted") return input.aiSaleRegistrationPending;
  return true;
}

export function saleRegistrationBlockedReason(input: {
  status: string;
  aiRegistrationPending: boolean;
  hasActiveSale: boolean;
}): "lost" | "already_registered" | null {
  if (input.status === "lost") return "lost";
  if (input.hasActiveSale || (input.status === "converted" && !input.aiRegistrationPending)) return "already_registered";
  return null;
}

export type SaleDocumentStatus = "pending" | "approved" | "rejected" | string;

export function requiredDocumentsStillMissing(input: {
  requirements: Array<{ id: string; required: boolean; appliesPerBeneficiary: boolean }>;
  beneficiaries: Array<{ id: string }>;
  documents: Array<{ requirementId?: string | null; beneficiaryId?: string | null; status: SaleDocumentStatus }>;
}) {
  return input.requirements.filter((requirement) => requirement.required).flatMap((requirement) => {
    if (!requirement.appliesPerBeneficiary) {
      const approved = input.documents.some((document) => document.requirementId === requirement.id && document.status === "approved");
      return approved ? [] : [requirement.id];
    }
    return input.beneficiaries
      .filter((beneficiary) => !input.documents.some((document) => document.requirementId === requirement.id && document.beneficiaryId === beneficiary.id && document.status === "approved"))
      .map((beneficiary) => `${requirement.id}:${beneficiary.id}`);
  });
}
