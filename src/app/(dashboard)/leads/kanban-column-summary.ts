/**
 * Resumo no cabeçalho da coluna do kanban Lite (25/11/2026): soma do valor mensal e vidas da etapa, só quando houver.
 * O valor só aparece com os valores comerciais ligados; a soma é em centavos exatos (`sumLeadCommercialValues`).
 */
import { sumLeadCommercialValues, type LeadCommercialValues } from "@/features/leads/commercial-values";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function kanbanColumnSummary(items: readonly LeadCommercialValues[], options: { showValue: boolean }): string | null {
  const totals = sumLeadCommercialValues(items);
  const parts: string[] = [];
  if (options.showValue && totals.monthlyValueCents > 0) parts.push(currency.format(totals.monthlyValueCents / 100));
  if (totals.livesCount > 0) parts.push(totals.livesCount === 1 ? "1 vida" : `${totals.livesCount} vidas`);
  return parts.length ? parts.join(" · ") : null;
}
