const CNPJ_TYPE_LABELS: Record<string, string> = {
  mei: "MEI",
  me: "ME",
  epp: "EPP",
  ltda: "LTDA",
  eireli: "EIRELI",
  slu: "SLU",
  sa: "S.A.",
  s_a: "S.A.",
  outro: "Outro CNPJ",
  outros: "Outro CNPJ",
};

function readCnpjType(sourceMetadata: unknown) {
  if (!sourceMetadata || typeof sourceMetadata !== "object" || Array.isArray(sourceMetadata)) return null;
  const value = (sourceMetadata as Record<string, unknown>).tipoCnpj;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatCnpjType(value: string) {
  const key = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return CNPJ_TYPE_LABELS[key] ?? value;
}

/**
 * The "Tipo" a broker sees for a lead: `leads.tipo` is stored upper-case
 * (PF/PJ/PME), and a Meta form's CNPJ type (MEI, LTDA…) both marks the lead
 * as a company plan and is shown alongside it — "PME · MEI".
 */
export function formatLeadTypeLabel(tipo: string | null | undefined, sourceMetadata?: unknown) {
  const cnpjType = readCnpjType(sourceMetadata);
  const normalized = tipo?.trim().toUpperCase();
  const base = normalized === "PJ" ? "Empresarial" : normalized === "PME" || cnpjType ? "PME" : "Pessoa Física";
  return cnpjType ? `${base} · ${formatCnpjType(cnpjType)}` : base;
}

/** The plan type the form answered, when the Meta mapping captured one. */
export function readSourcePlanType(sourceMetadata: unknown) {
  if (!sourceMetadata || typeof sourceMetadata !== "object" || Array.isArray(sourceMetadata)) return null;
  const value = (sourceMetadata as Record<string, unknown>).tipoPlano;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
