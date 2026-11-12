import { z } from "zod";

export const ERP_MODULE_KEYS = ["implantations", "finance", "imports", "referrals", "incentives", "analytics", "tv"] as const;
export type ErpModuleKey = (typeof ERP_MODULE_KEYS)[number];
export const ERP_IMPLEMENTED_MODULES: ReadonlySet<ErpModuleKey> = new Set(ERP_MODULE_KEYS);
export const IMPORT_STATUS = { preview: "A conferir", applied: "Aplicado", rejected: "Rejeitado" };
export const erpModuleKeySchema = z.enum(ERP_MODULE_KEYS);
export const ERP_ROLES = ["director", "manager", "supervisor", "broker"] as const;
export const ERP_AUDIENCES = [...ERP_ROLES, "finance", "operations", "marketing", "support"] as const;
export const erpModuleSettingsSchema = z.object({
  module: erpModuleKeySchema,
  enabled: z.boolean(),
  roles: z.array(z.enum(ERP_AUDIENCES)).min(1).max(8).refine((roles) => new Set(roles).size === roles.length),
  maxImportRows: z.number().int().min(1).max(500),
  expectedVersion: z.number().int().nonnegative(),
}).strict();

export const ERP_MODULES: readonly { key: ErpModuleKey; label: string; description: string; dependencies: readonly ErpModuleKey[] }[] = [
  { key: "implantations", label: "Implantação", description: "Da venda à cobertura ativa, com pendências e evidências.", dependencies: [] },
  { key: "finance", label: "Financeiro", description: "Valores conferidos, aprovação independente e liquidação rastreável.", dependencies: [] },
  { key: "imports", label: "Importações", description: "Prévia de arquivos, validação e aplicação sem duplicidade.", dependencies: [] },
  { key: "referrals", label: "Indicações", description: "Origem, responsável e acompanhamento da indicação.", dependencies: [] },
  { key: "incentives", label: "Incentivos", description: "Regulamentos e apurações reproduzíveis.", dependencies: ["analytics"] },
  { key: "analytics", label: "Inteligência", description: "Produção, implantação e valores liquidados, com memória de cálculo.", dependencies: [] },
  { key: "tv", label: "Modo TV", description: "Apresentação autenticada de indicadores agregados permitidos.", dependencies: ["analytics"] },
];

export class ErpError extends Error {
  constructor(message: string) { super(message); this.name = "ErpError"; }
}

export const recordIdSchema = z.string().trim().min(1).max(100);
export const referenceSchema = z.string().trim().regex(/^[\w.:-]{1,100}$/, "Use uma referência de até 100 letras, números, ponto, hífen ou dois-pontos.");
export const dateSchema = z.iso.date();
export const evidenceSchema = z.string().uuid("Selecione uma evidência válida.");
export const MAX_CENTS = 100_000_000_000;
export const moneyCentsSchema = z.number().int().positive().max(MAX_CENTS).refine(Number.isSafeInteger);

/** Decimal input is converted without floating-point multiplication. */
export function parseMoneyCents(raw: string): number {
  const value = raw.trim().replace(/^R\$\s*/, "");
  if (value.includes(",") && !/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(value)) throw new ErpError("Confira os separadores do valor informado.");
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized)) throw new ErpError("Informe um valor com até duas casas decimais.");
  const [units, fraction = ""] = normalized.split(".");
  const result = Number(BigInt(units) * BigInt(100) + BigInt(fraction.padEnd(2, "0")));
  const parsed = moneyCentsSchema.safeParse(result);
  if (!parsed.success) throw new ErpError("Informe um valor positivo dentro do limite permitido.");
  return parsed.data;
}

export function formatCents(value: number) {
  if (!Number.isSafeInteger(value)) throw new ErpError("Valor indisponível para conferência.");
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const IMPLANTATION_STATUSES = ["awaiting_documents", "review", "submitted", "operator_pending", "implanted", "refused", "cancelled"] as const;
export type ImplantationStatus = (typeof IMPLANTATION_STATUSES)[number];
export const IMPLANTATION_LABELS: Record<ImplantationStatus, string> = {
  awaiting_documents: "Aguardando documentos", review: "A conferir", submitted: "Enviada à operadora",
  operator_pending: "Pendência da operadora", implanted: "Implantada", refused: "Recusada", cancelled: "Cancelada",
};
const implantationTransitions: Record<ImplantationStatus, readonly ImplantationStatus[]> = {
  awaiting_documents: ["review", "cancelled"], review: ["awaiting_documents", "submitted", "implanted", "refused", "cancelled"],
  submitted: ["operator_pending", "implanted", "refused", "cancelled"], operator_pending: ["review", "submitted", "implanted", "refused", "cancelled"],
  implanted: ["review", "cancelled"], refused: ["review"], cancelled: ["review"],
};
export function availableImplantationStages(from: ImplantationStatus) { return [from, ...implantationTransitions[from]]; }
export const implantationInputSchema = z.object({
  leadId: recordIdSchema, expectedVersion: z.number().int().nonnegative(),
  status: z.enum(IMPLANTATION_STATUSES), reference: z.string().trim().max(100),
  policyNumber: z.string().trim().max(100), coverageStartsOn: dateSchema.nullable(),
  evidenceDocumentId: evidenceSchema.nullable(), reason: z.string().trim().max(500),
}).strict();

export function assertImplantationTransition(from: ImplantationStatus, input: z.infer<typeof implantationInputSchema>) {
  if (from !== input.status && !implantationTransitions[from].includes(input.status)) throw new ErpError("Essa mudança de etapa exige uma conferência anterior.");
  if (["cancelled", "refused"].includes(input.status) && input.reason.length < 5) throw new ErpError("Explique o motivo da recusa ou cancelamento.");
  if (["implanted", "refused", "cancelled"].includes(from) && input.status === "review" && input.reason.length < 5) throw new ErpError("Informe o motivo da reabertura.");
  if (input.status === "implanted" && (!input.evidenceDocumentId || !input.coverageStartsOn || !input.policyNumber)) throw new ErpError("Para comprovar a implantação, informe apólice, início de cobertura e evidência.");
}

export const FINANCIAL_KINDS = ["client_premium", "agency_receivable", "broker_commission", "expense", "advance"] as const;
export type FinancialKind = (typeof FINANCIAL_KINDS)[number];
export const FINANCIAL_LABELS: Record<FinancialKind, string> = {
  client_premium: "Mensalidade do cliente", agency_receivable: "Recebível da corretora", broker_commission: "Comissão do corretor", expense: "Despesa", advance: "Adiantamento",
};
export function financialDirection(kind: FinancialKind): "in" | "out" | "external" {
  return kind === "agency_receivable" ? "in" : kind === "client_premium" ? "external" : "out";
}

export const financialInputSchema = z.object({
  requestId: z.string().uuid(), reference: referenceSchema, kind: z.enum(FINANCIAL_KINDS),
  saleId: recordIdSchema.nullable(), branchId: recordIdSchema.nullable(), beneficiaryId: recordIdSchema.nullable(),
  amountCents: moneyCentsSchema, dueOn: dateSchema, competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  description: z.string().trim().min(3).max(180), evidenceDocumentId: evidenceSchema.nullable(),
}).strict().superRefine((input, context) => {
  if (["client_premium", "agency_receivable", "broker_commission"].includes(input.kind) && !input.saleId) context.addIssue({ code: "custom", message: "Vincule este lançamento à venda.", path: ["saleId"] });
  if (["broker_commission", "advance"].includes(input.kind) && !input.beneficiaryId) context.addIssue({ code: "custom", message: "Selecione o beneficiário.", path: ["beneficiaryId"] });
});

export const settlementInputSchema = z.object({
  requestId: z.string().uuid(), entryId: z.string().uuid(), amountCents: moneyCentsSchema,
  occurredOn: dateSchema, evidenceDocumentId: evidenceSchema, reason: z.string().trim().min(3).max(300),
}).strict();

export function assertIndependentReview(actorId: string, preparedBy: string) {
  if (actorId === preparedBy) throw new ErpError("A aprovação precisa ser feita por outra pessoa autorizada.");
}

export type ErpActionResult = { ok: true; message: string; id?: string } | { ok: false; message: string };
