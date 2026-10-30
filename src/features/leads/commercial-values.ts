export type LeadCommercialValues = {
  monthlyValue?: string | number | null;
  livesCount?: number | null;
};

export type CommercialTotals = {
  monthlyValueCents: number;
  livesCount: number;
};

export function legacyLeadLivesCount(details: unknown): number | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const values = details as Record<string, unknown>;
  const raw = values.qtdVidas ?? values.quantidadeVidas ?? values.numberOfLives;
  const count = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
  return Number.isInteger(count) && count > 0 && count <= 100 ? count : null;
}

/**
 * A negociação formal é mais específica que a estimativa do lead: venda ativa,
 * proposta aberta e, por fim, o valor do lead preenchido por cotação/manual.
 */
export function resolveLeadCommercialValues(input: {
  lead: LeadCommercialValues;
  proposalMonthlyValue?: string | number | null;
  proposalLivesCount?: number | null;
  activeSaleMonthlyValue?: string | number | null;
}): { monthlyValue: string | number | null; livesCount: number | null; source: "sale" | "proposal" | "lead" | null } {
  const rawMonthly = input.activeSaleMonthlyValue ?? input.proposalMonthlyValue ?? input.lead.monthlyValue ?? null;
  const monthly = rawMonthly == null ? Number.NaN : Number(rawMonthly);
  const rawLives = input.proposalLivesCount ?? input.lead.livesCount ?? null;
  const lives = Number(rawLives);
  return {
    monthlyValue: Number.isFinite(monthly) && monthly >= 0 ? rawMonthly : null,
    livesCount: Number.isInteger(lives) && lives > 0 && lives <= 100 ? lives : null,
    source: input.activeSaleMonthlyValue != null ? "sale"
      : input.proposalMonthlyValue != null ? "proposal"
      : input.lead.monthlyValue != null || input.lead.livesCount != null ? "lead"
      : null,
  };
}

/** Converts the persisted quote summary into the lead's nullable numeric snapshot. */
export function quoteCommercialValues(input: {
  totalMonthly: string | number | null | undefined;
  beneficiaryCount: number | null | undefined;
}): { monthlyValue: string | null; livesCount: number | null } {
  const monthly = input.totalMonthly == null ? Number.NaN : Number(input.totalMonthly);
  const monthlyValue = Number.isFinite(monthly) && monthly >= 0 ? monthly.toFixed(2) : null;
  const livesCount = Number.isInteger(input.beneficiaryCount) && Number(input.beneficiaryCount) > 0 && Number(input.beneficiaryCount) <= 100
    ? Number(input.beneficiaryCount)
    : null;

  return { monthlyValue, livesCount };
}

/** Sums exact cents to avoid floating-point drift across a Kanban column. */
export function sumLeadCommercialValues(leads: readonly LeadCommercialValues[]): CommercialTotals {
  let monthlyValueCents = 0;
  let livesCount = 0;

  for (const lead of leads) {
    const monthlyValue = lead.monthlyValue == null ? Number.NaN : Number(lead.monthlyValue);
    if (Number.isFinite(monthlyValue) && monthlyValue >= 0) {
      monthlyValueCents += Math.round(monthlyValue * 100);
    }

    if (Number.isInteger(lead.livesCount) && Number(lead.livesCount) > 0) {
      livesCount += Number(lead.livesCount);
    }
  }

  return { monthlyValueCents, livesCount };
}

export function formatLeadCommercialTotals(totals: CommercialTotals): string {
  const monthlyValue = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totals.monthlyValueCents / 100);
  const livesLabel = totals.livesCount === 1 ? "1 vida" : `${totals.livesCount} vidas`;

  return `${monthlyValue} · ${livesLabel}`;
}
