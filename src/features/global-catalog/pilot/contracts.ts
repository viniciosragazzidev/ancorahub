import { z } from "zod";

export const PILOT_SETTING = "quote_catalog_pilot_v1";
export const RELEASE_PATTERN = /^cotadorfm-\d{4}-\d{2}-\d{2}-[a-f0-9]{12}$/;
export const pilotConfigSchema = z.object({
  enabled: z.boolean(), userId: z.string().uuid(), tenantId: z.string().uuid(),
  release: z.string().regex(RELEASE_PATTERN), indexHash: z.string().regex(/^[a-f0-9]{64}$/),
  reviewedPlanIds: z.array(z.string().uuid()).max(5000).default([]),
  hiddenPlanIds: z.array(z.string().uuid()).max(5000).default([]),
});
export type PilotConfig = z.infer<typeof pilotConfigSchema>;
export const modalities = ["ADESAO", "PME_EMPRESARIAL", "PESSOA_FISICA", "ADESAO_ODONTO", "PME_EMPRESARIAL_ODONTO", "PESSOA_FISICA_ODONTO"] as const;
export const quoteInputSchema = z.object({
  modality: z.enum(modalities), city: z.string().trim().max(120).default(""),
  lives: z.array(z.object({ age: z.number().int().min(0).max(120), holder: z.boolean(), relationship: z.string().max(40).default("") })).min(1).max(100),
  operator: z.string().max(120).default(""), administrator: z.string().max(120).default(""),
  profession: z.string().max(120).default(""), entity: z.string().max(300).default(""),
  businessProfile: z.string().max(60).default(""), businessMonths: z.number().int().min(0).max(2400).nullable().default(null),
  accommodation: z.string().max(80).default(""), coparticipation: z.string().max(100).default(""),
  coverage: z.string().max(120).default(""), dental: z.enum(["", "yes", "no", "unknown"]).default(""),
  query: z.string().trim().max(160).default(""), budgetCents: z.number().int().positive().max(999999999999).nullable().default(null),
  includeIncompatible: z.boolean().default(false), page: z.number().int().min(1).max(10000).default(1),
}).superRefine((value, ctx) => {
  if (value.lives.filter(l => l.holder).length !== 1) ctx.addIssue({ code: "custom", path: ["lives"], message: "Indique exatamente um titular." });
  if (value.modality.startsWith("PME") && !value.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Informe o município de comercialização." });
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type Price = { id: string; cents: number; min: number; max: number | null; active: boolean; from: string | null; to: string | null; priority: number; lives: number | null };
export type CatalogPlan = {
  id: string; name: string; code: string; operator: string; operatorId: string; administrator: string;
  modality: string; accommodation: string; coparticipation: string; coverage: string;
  entity: string; cities: string[]; businessProfiles: string[]; dental: boolean | null;
  minAge: number | null; maxAge: number | null; holderMin: number | null; holderMax: number | null;
  dependentMin: number | null; dependentMax: number | null; minLives: number | null; maxLives: number | null;
  minHolders: number | null; ageConfirmed: boolean; eligibilityConfirmed: boolean; businessConfirmed: boolean;
  from: string | null; to: string | null; prices: Price[]; networkCount: number; detailCount: number;
};
export type CatalogIndex = {
  schemaVersion: 1; sourceDate: string; release: string; plans: CatalogPlan[];
  options: { professions: { label: string; value: string }[]; businessProfiles: string[]; cities: string[] };
  counts: { plans: number; prices: number; details: number; networkMemberships: number; units: number };
  shardHashes: Record<string, string>;
};
export type CatalogOptions = CatalogIndex["options"] & {
  operators: { value: string; label: string }[]; administrators: string[];
  accommodations: string[]; coparticipations: string[]; coverages: string[]; entities: string[];
};
export type QuoteResult = Omit<CatalogPlan, "prices" | "cities" | "businessProfiles"> & {
  totalCents: number; perLife: { age: number; holder: boolean; priceId: string; cents: number; from: string | null; to: string | null }[];
  state: "ready" | "pending" | "incompatible"; reasons: string[];
};
export type QuoteResponse = { results: QuoteResult[]; total: number; page: number; pages: number; compatible: number; pending: number; incompatible: number; release: string; date: string };
export type SourceDetail = { id: string; titulo?: string; resumo?: string; descricao?: string; conteudo?: string; conteudo_estruturado?: unknown; fonte?: string; ativo?: boolean; tipo_detalhe?: string; vigencia_inicio?: string; vigencia_fim?: string; exportavel_pdf?: boolean; visivel_cotacao?: boolean };
export type PlanDetail = { plan: Record<string, unknown>; details: SourceDetail[] };
export type NetworkUnit = { id: string; nome?: string; cidade?: string; bairro?: string; tipo?: string; endereco?: string; cep?: string; telefone?: string; telefone_2?: string; email?: string; whatsapp?: string; site?: string; especialidades?: unknown; grupos_servico?: unknown; servicos_inclusos?: unknown; fonte?: unknown; [key: string]: unknown };
export type NetworkData = { plano: Record<string, unknown>; unidades: NetworkUnit[]; competencia?: string; ultima_conferencia?: string; nivel_detalhe?: string; fontes?: unknown; [key: string]: unknown };

export function canUsePilot(context: { userId: string; tenantId: string; role: string }, config: PilotConfig | null) {
  return Boolean(config?.enabled && context.role === "broker" && context.userId === config.userId && context.tenantId === config.tenantId);
}
