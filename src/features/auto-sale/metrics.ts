/** Métricas do piloto (§14). Puro: recebe a linha da negociação e conta. */

export const BASELINE = { firstMessageMinutes: 17, quoteAfterMinutes: 10, documentsAfterHours: 0.9 } as const;

export type DealMetricsInput = {
  createdAt: Date;
  firstQuoteAt: Date | null;
  documentsRequestedAt: Date | null;
  firstSentAt: Date | null;
  customerReplies: number;
  offers: number;
  pdfsSent: number;
  managerCalls: { reason: string }[];
  aiCostUsd: number;
  transcriptionCostUsd: number;
  reachedUnderAnalysis: boolean;
};

const minutes = (from: Date, to: Date | null) => (to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000)) : null);

export function dealMetrics(input: DealMetricsInput) {
  return {
    minutesToFirstMessage: minutes(input.createdAt, input.firstSentAt),
    minutesToFirstQuote: minutes(input.createdAt, input.firstQuoteAt),
    hoursToDocuments: input.documentsRequestedAt ? Math.round(((input.documentsRequestedAt.getTime() - input.createdAt.getTime()) / 3_600_000) * 10) / 10 : null,
    documentsRequested: Boolean(input.documentsRequestedAt),
    proposalSigned: input.reachedUnderAnalysis,
    customerReplies: input.customerReplies,
    offers: input.offers,
    pdfsSent: input.pdfsSent,
    managerCalls: input.managerCalls.length,
    managerCallReasons: [...new Set(input.managerCalls.map((call) => call.reason))],
    costUsd: Math.round((input.aiCostUsd + input.transcriptionCostUsd) * 10_000) / 10_000,
  };
}

export function formatUsd(value: number) {
  return `US$ ${value.toFixed(value < 1 ? 4 : 2).replace(".", ",")}`;
}
