import type { PeriodValue } from "@/shared/period";
import type { CommercialOverview, FunnelSnapshot, AttentionSnapshot, SourcePerformanceRow } from "@/features/reports/metrics/metrics-types";
import { sourceLabel } from "@/features/reports/metrics/metrics-types";
import { KpiComparisonCard } from "./kpi-comparison-card";
import { FunnelSection } from "./funnel-section";
import { AttentionSection } from "./attention-section";
import { comparisonDelta } from "@/features/reports/metrics/metrics-math";
import { TrendUp, Target, Users, ChartBar, CurrencyCircleDollar } from "@/components/huge-icons";

interface CommercialTabProps {
  readonly period: PeriodValue;
  readonly overview: CommercialOverview;
  readonly funnel: FunnelSnapshot;
  readonly attention: AttentionSnapshot;
  readonly sourcePerformance: readonly SourcePerformanceRow[];
}

export function CommercialTab({ period, overview, funnel, attention, sourcePerformance }: CommercialTabProps) {
  const conversionDelta = comparisonDelta(overview.conversion.rate, overview.previousConversion.rate, "rate");
  const salesDelta = comparisonDelta(overview.sales, overview.previousSales, "value");
  const revenueDelta = overview.revenue !== null && overview.previousRevenue !== null
    ? comparisonDelta(overview.revenue, overview.previousRevenue, "value")
    : undefined;
  const avgTicketDelta = overview.avgTicket !== null && overview.previousAvgTicket !== null
    ? comparisonDelta(overview.avgTicket, overview.previousAvgTicket, "value")
    : undefined;

  return (
    <>
      <section aria-labelledby="commercial-kpi-title">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="size-3.5" aria-hidden="true" />
          <h2 id="commercial-kpi-title" className="font-medium text-foreground">Indicadores comerciais</h2>
          <span aria-hidden="true">•</span>
          <span>Últimos {period} dias</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiComparisonCard
            label="Conversão"
            value={`${overview.conversion.rate.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
            sublabel={`${overview.conversion.received} leads recebidos`}
            icon={Target}
            iconClassName="bg-chart-4/10 text-chart-4"
            delta={conversionDelta}
          />
          <KpiComparisonCard
            label="Vendas"
            value={overview.sales}
            sublabel="Registros do período"
            icon={TrendUp}
            iconClassName="bg-chart-2/10 text-chart-2"
            delta={salesDelta}
          />
          {overview.revenue !== null && (
            <KpiComparisonCard
              label="Receita ativa"
              value={overview.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sublabel="Vendas ativas no período"
              icon={CurrencyCircleDollar}
              iconClassName="bg-success/10 text-success"
              delta={revenueDelta}
              isCurrency
            />
          )}
          {overview.avgTicket !== null && (
            <KpiComparisonCard
              label="Ticket médio"
              value={overview.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sublabel="Receita / vendas"
              icon={Users}
              iconClassName="bg-chart-1/10 text-chart-1"
              delta={avgTicketDelta}
              isCurrency
            />
          )}
          <KpiComparisonCard
            label="Leads recebidos"
            value={overview.conversion.received}
            sublabel={`Nos últimos ${period} dias`}
            icon={Users}
            iconClassName="bg-chart-1/10 text-chart-1"
          />
        </div>
      </section>

      <FunnelSection funnel={funnel} />

      <AttentionSection attention={attention} period={period} />

      <section aria-labelledby="source-performance-title">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ChartBar className="size-3.5" aria-hidden="true" />
          <h2 id="source-performance-title" className="font-medium text-foreground">Desempenho por canal</h2>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Convertidos</th>
                <th className="px-4 py-3 text-right">Conversão</th>
                <th className="px-4 py-3 text-right">Vendas</th>
              </tr>
            </thead>
            <tbody>
              {sourcePerformance.map((row) => {
                const convRate = row.leads > 0 ? ((row.converted / row.leads) * 100).toFixed(1) : "0,0";
                return (
                  <tr key={row.source} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{sourceLabel(row.source)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.leads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.converted}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{convRate}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.sales}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
