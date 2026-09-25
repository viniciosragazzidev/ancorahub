/** Brazilian area codes (DDD) by state — the 67 in use. Safe for client components. */
export const BRAZIL_DDDS_BY_STATE: ReadonlyArray<{ uf: string; ddds: readonly string[] }> = [
  { uf: "AC", ddds: ["68"] },
  { uf: "AL", ddds: ["82"] },
  { uf: "AM", ddds: ["92", "97"] },
  { uf: "AP", ddds: ["96"] },
  { uf: "BA", ddds: ["71", "73", "74", "75", "77"] },
  { uf: "CE", ddds: ["85", "88"] },
  { uf: "DF", ddds: ["61"] },
  { uf: "ES", ddds: ["27", "28"] },
  { uf: "GO", ddds: ["62", "64"] },
  { uf: "MA", ddds: ["98", "99"] },
  { uf: "MG", ddds: ["31", "32", "33", "34", "35", "37", "38"] },
  { uf: "MS", ddds: ["67"] },
  { uf: "MT", ddds: ["65", "66"] },
  { uf: "PA", ddds: ["91", "93", "94"] },
  { uf: "PB", ddds: ["83"] },
  { uf: "PE", ddds: ["81", "87"] },
  { uf: "PI", ddds: ["86", "89"] },
  { uf: "PR", ddds: ["41", "42", "43", "44", "45", "46"] },
  { uf: "RJ", ddds: ["21", "22", "24"] },
  { uf: "RN", ddds: ["84"] },
  { uf: "RO", ddds: ["69"] },
  { uf: "RR", ddds: ["95"] },
  { uf: "RS", ddds: ["51", "53", "54", "55"] },
  { uf: "SC", ddds: ["47", "48", "49"] },
  { uf: "SE", ddds: ["79"] },
  { uf: "SP", ddds: ["11", "12", "13", "14", "15", "16", "17", "18", "19"] },
  { uf: "TO", ddds: ["63"] },
];

const ALL_DDDS = new Set(BRAZIL_DDDS_BY_STATE.flatMap((state) => state.ddds));

export type DddOutcome = "valid" | "invalid" | "unknown";

/**
 * Tenant-wide DDD rule: which area codes are served, and which queue a lead
 * goes to in each situation. A null queue means "keep the normal flow".
 */
export type DddRoutingSettings = {
  enabled: boolean;
  validDdds: string[];
  queues: Record<DddOutcome, string | null>;
};

export const DEFAULT_DDD_ROUTING_SETTINGS: DddRoutingSettings = {
  enabled: false,
  validDdds: [],
  queues: { valid: null, invalid: null, unknown: null },
};

export const DDD_OUTCOME_LABELS: Record<DddOutcome, string> = {
  valid: "DDD válido",
  invalid: "DDD inválido",
  unknown: "Sem DDD identificável",
};

/** The Brazilian DDD of a phone (with or without +55, formatted or not), or null. */
export function extractBrazilianDdd(phone: string | null | undefined): string | null {
  const raw = String(phone ?? "").trim();
  // An explicit international number (+XX / 00XX) from another country is
  // foreign even when its digits happen to look like DDD + number.
  const compact = raw.replace(/[\s().-]/g, "");
  if ((compact.startsWith("+") && !compact.startsWith("+55")) || (compact.startsWith("00") && !compact.startsWith("0055"))) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0055")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  return ALL_DDDS.has(ddd) ? ddd : null;
}

/** Accepts only known DDDs and well-formed queue ids; anything else falls back to the default. */
export function normalizeDddRoutingSettings(value: unknown): DddRoutingSettings {
  if (!value || typeof value !== "object") return DEFAULT_DDD_ROUTING_SETTINGS;
  const raw = value as Partial<DddRoutingSettings>;
  const queue = (id: unknown) => (typeof id === "string" && id.trim() ? id.trim() : null);
  const rawQueues = (raw.queues && typeof raw.queues === "object" ? raw.queues : {}) as Partial<Record<DddOutcome, unknown>>;
  return {
    enabled: raw.enabled === true,
    validDdds: [...new Set((Array.isArray(raw.validDdds) ? raw.validDdds : []).map(String).filter((ddd) => ALL_DDDS.has(ddd)))].sort(),
    queues: { valid: queue(rawQueues.valid), invalid: queue(rawQueues.invalid), unknown: queue(rawQueues.unknown) },
  };
}

/** Which situation the lead's phone falls in, and the queue configured for it. */
export function decideDddRouting(settings: DddRoutingSettings, phone: string | null | undefined): {
  outcome: DddOutcome;
  ddd: string | null;
  queueId: string | null;
  reason: string;
} | null {
  if (!settings.enabled) return null;
  const ddd = extractBrazilianDdd(phone);
  const outcome: DddOutcome = !ddd ? "unknown" : settings.validDdds.includes(ddd) ? "valid" : "invalid";
  const reason = outcome === "unknown"
    ? "Telefone sem DDD brasileiro identificável"
    : outcome === "valid"
      ? `DDD ${ddd} está entre os DDDs válidos`
      : `DDD ${ddd} está fora dos DDDs válidos`;
  return { outcome, ddd, queueId: settings.queues[outcome], reason };
}
