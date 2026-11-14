/**
 * Meu financeiro do corretor: regras puras de apresentação, sem fórmula nova.
 * Os valores vêm das somas que o ERP já usa (saldo em aberto, liquidação confirmada, saldo de adiantamento);
 * aqui só se decide o estado textual de uma parcela e quando um número vira "Sem dado".
 */
import { formatCompetence } from "./ui/format";

export type BrokerCommissionState = "prevista" | "conferida" | "paga" | "cancelada" | "estorno";

export const BROKER_COMMISSION_STATE_LABELS: Record<BrokerCommissionState, string> = {
  prevista: "Prevista",
  conferida: "Conferida",
  paga: "Paga",
  cancelada: "Cancelada",
  estorno: "Em revisão de estorno",
};

/**
 * Estado de uma parcela do cronograma para o corretor:
 * - lançamento aprovado no ERP com liquidação e compensação confirmadas cobrindo o valor: paga;
 * - lançamento aprovado no ERP: conferida;
 * - sem lançamento aprovado, vale o cronograma (DEC-185: o cronograma só fala enquanto o ERP não controla a parcela).
 */
export function brokerCommissionState(input: {
  scheduleStatus: string;
  entry: { status: string; amountCents: number; settledCents: number } | null;
}): { state: BrokerCommissionState; source: "erp" | "cronograma" } {
  const { entry, scheduleStatus } = input;
  if (entry?.status === "approved") return { state: entry.settledCents >= entry.amountCents ? "paga" : "conferida", source: "erp" };
  if (scheduleStatus === "paid") return { state: "paga", source: "cronograma" };
  if (scheduleStatus === "cancelled") return { state: "cancelada", source: "cronograma" };
  if (scheduleStatus === "chargeback_pending") return { state: "estorno", source: "cronograma" };
  return { state: "prevista", source: "cronograma" };
}

/** Sem lançamento aprovado do tipo, não há base: o número é "Sem dado", nunca zero. */
export function amountOrNoData(baseCount: number, cents: number): number | null {
  return baseCount > 0 ? cents : null;
}

/** "novembro de 2026" para uma competência AAAA-MM (mesmo formato das telas do ERP). */
export function periodLabel(period: string) {
  return formatCompetence(period, "long");
}

/** BRL para centavos inteiros; null vira "Sem dado". */
export function formatBrokerCents(cents: number | null) {
  if (cents === null || !Number.isSafeInteger(cents)) return "Sem dado";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type BrokerFinanceSummary = {
  /** Competência corrente em São Paulo (AAAA-MM). */
  period: string;
  periodLabel: string;
  /** null = sem base no ERP (mostrar "Sem dado"), nunca zero inventado. */
  receivableCents: number | null;
  receivedThisMonthCents: number | null;
  openAdvancesCents: number | null;
};

export type BrokerCommissionRow = {
  id: string;
  clientName: string;
  product: string | null;
  installment: number;
  referenceMonth: string;
  amountCents: number;
  state: BrokerCommissionState;
  stateLabel: string;
  source: "erp" | "cronograma";
};

export type BrokerPayoutRow = { id: string; competence: string; occurredOn: string | null; netCents: number; receiptNumber: string | null; receiptHref: string | null };

export type BrokerFinanceDetail = {
  summary: BrokerFinanceSummary;
  commissions: { rows: BrokerCommissionRow[]; page: number; pageSize: number; hasNext: boolean };
  payouts: BrokerPayoutRow[];
  receiptsHref: string | null;
};
