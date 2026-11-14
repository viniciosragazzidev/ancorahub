import { z } from "zod";

/**
 * Entradas do "Cliente que já possuo" (DEC-187). Sem dependência de servidor para a tela usar os mesmos tipos.
 * Contrato anterior não tem valor nem comissão; o que o corretor não souber fica nulo e aparece como pendente.
 */
export const PRIOR_CONTRACT_PRODUCTS = ["PF", "PJ", "adesao", "odonto", "outro", "unknown"] as const;
export const PRIOR_CONTRACT_STATUSES = ["active", "cancelled", "unknown"] as const;
export const PRIOR_CONTRACTS_MAX = 5;
export const PRIOR_RENEWAL_WINDOW_DAYS = 30;

export const PRIOR_PRODUCT_LABELS: Record<(typeof PRIOR_CONTRACT_PRODUCTS)[number], string> = {
  PF: "Pessoa física",
  PJ: "Empresarial (PJ)",
  adesao: "Adesão",
  odonto: "Odonto",
  outro: "Outro",
  unknown: "Não informado",
};
export const PRIOR_STATUS_LABELS: Record<(typeof PRIOR_CONTRACT_STATUSES)[number], string> = {
  active: "Ativo",
  cancelled: "Cancelado",
  unknown: "Não informado",
};

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida.").refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Use uma data válida.");
const optionalDate = isoDate.optional().or(z.literal("")).transform((value) => value || null);
const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional().or(z.literal("")).transform((value) => value || null);

export const priorContractSchema = z.object({
  productType: z.enum(PRIOR_CONTRACT_PRODUCTS).default("unknown"),
  carrierName: optionalText(120, "Use até 120 caracteres."),
  coverageStartDate: optionalDate,
  renewalDate: optionalDate,
  status: z.enum(PRIOR_CONTRACT_STATUSES).default("unknown"),
}).refine((contract) => !contract.coverageStartDate || !contract.renewalDate || contract.renewalDate >= contract.coverageStartDate, {
  message: "A renovação não pode ser antes do início da vigência.",
  path: ["renewalDate"],
});

export const priorClientSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Use até 120 caracteres."),
  telefone: z.string().trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 13, "Informe um celular com DDD (ex: 11 99999-9999)."),
  email: z.string().trim().max(254, "Use até 254 caracteres.").email("Informe um e-mail válido.").optional().or(z.literal("")).transform((value) => value || null),
  observacao: optionalText(2000, "A observação deve ter no máximo 2.000 caracteres."),
  contracts: z.array(priorContractSchema).max(PRIOR_CONTRACTS_MAX, `Cadastre até ${PRIOR_CONTRACTS_MAX} contratos por vez.`).default([]),
  duplicateConfirmed: z.boolean().optional(),
});

export type PriorClientInput = z.input<typeof priorClientSchema>;
export type PriorClientData = z.output<typeof priorClientSchema>;
export type PriorContractInput = z.input<typeof priorContractSchema>;
export type PriorContractData = z.output<typeof priorContractSchema>;

export type PriorFieldErrors = Record<string, string>;

/** Mensagens por campo; contratos usam a chave `contracts.<i>.<campo>`. */
export function collectFieldErrors(error: z.ZodError): PriorFieldErrors {
  const fieldErrors: PriorFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export type PriorClientResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string; fieldErrors?: PriorFieldErrors }
  /** Do próprio corretor: link para o registro dele. De fora do escopo: só o aviso, sem nome nem responsável. */
  | { ok: false; duplicate: { mine: true; href: string; name: string } | { mine: false } };

export type PriorContractActionResult = { ok: true; contractId?: string } | { ok: false; error: string; fieldErrors?: PriorFieldErrors };

/** Pendências do contrato anterior: o que não foi informado. Nunca vira "em dia". */
export function priorContractPending(contract: { productType: string; carrierName: string | null; coverageStartDate: string | null; renewalDate: string | null; status: string }) {
  const pending: string[] = [];
  if (contract.productType === "unknown") pending.push("produto");
  if (!contract.carrierName) pending.push("operadora");
  if (!contract.coverageStartDate) pending.push("início da vigência");
  if (!contract.renewalDate) pending.push("renovação");
  if (contract.status === "unknown") pending.push("situação");
  return pending;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Mesma janela da DEC-180: contrato anterior ativo com renovação entre hoje e 30 dias (datas de São Paulo). */
export function isPriorContractRenewalAttention(contract: { status: string; renewalDate: string | null }, todayKey: string) {
  return contract.status === "active"
    && Boolean(contract.renewalDate)
    && contract.renewalDate! >= todayKey
    && contract.renewalDate! <= addDays(todayKey, PRIOR_RENEWAL_WINDOW_DAYS);
}

export function priorRenewalCutoff(todayKey: string) {
  return addDays(todayKey, PRIOR_RENEWAL_WINDOW_DAYS);
}
