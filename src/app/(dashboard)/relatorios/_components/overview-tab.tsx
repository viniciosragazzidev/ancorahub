import type { PeriodValue } from "@/shared/period";
import type { CommercialOverview, FunnelSnapshot, AttentionSnapshot } from "@/features/reports/metrics/metrics-service";
import { comparisonDelta, formatRatePtBR } from "@/features/reports/metrics/metrics-math";
import { KpiComparisonCard } from "./kpi-comparison-card";
import { FunnelSection } from "./funnel-section";
import { AttentionSection } from "./attention-section";
import { ChartBar, TrendUp, CurrencyCircleDollar, Users, Target } from "@/components/huge-icons";

interface OverviewTabProps {
  readonly period: PeriodValue;
  readonly commercial: CommercialOverview;
  readonly funnel: FunnelSnapshot;
  readonly attention: AttentionSnapshot;
}

export function OverviewTab({ period, commercial, funnel, attention }: OverviewTabProps) {
  const conversionDelta = comparisonDelta(commercial.conversion.rate, commercial.previousConversion.rate, "rate");
  const salesDelta = comparisonDelta(commercial.sales, commercial.previousSales, "value");
  const revenueDelta = commercial.revenue !== null && commercial.previousRevenue !== null
    ? comparisonDelta(commercial.revenue, commercial.previousRevenue, "value")
    : undefined;
  const avgTicketDelta = commercial.avgTicket !== null && commercial.previousAvgTicket !== null
    ? comparisonDelta(commercial.avgTicket, commercial.previousAvgTicket, "value")
    : undefined;

  return (
    <>
      <section aria-labelledby="overview-kpi-title">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ChartBar className="size-3.5" aria-hidden="true" />
          <h2 id="overview-kpi-title" className="font-medium text-foreground">Resumo do período</h2>
          <span aria-hidden="true">•</span>
          <span>Últimos {period} dias</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiComparisonCard
            label="Conversão"
            value={`${commercial.conversion.rate.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
            sublabel={`${commercial.conversion.received} leads recebidos`}
            icon={Target}
            iconClassName="bg-chart-4/10 text-chart-4"
            delta={conversionDelta}
          />
          <KpiComparisonCard
            label="Vendas"
            value={commercial.sales}
            sublabel="Registros do período"
            icon={TrendUp}
            iconClassName="bg-chart-2/10 text-chart-2"
            delta={salesDelta}
          />
          {commercial.revenue !== null && (
            <KpiComparisonCard
              label="Receita ativa"
              value={commercial.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sublabel="Vendas ativas no período"
              icon={CurrencyCircleDollar}
              iconClassName="bg-success/10 text-success"
              delta={revenueDelta}
              isCurrency
            />
          )}
          {commercial.avgTicket !== null && (
            <KpiComparisonCard
              label="Ticket médio"
              value={commercial.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sublabel="Receita / vendas"
              icon={Users}
              iconClassName="bg-chart-1/10 text-chart-1"
              delta={avgTicketDelta}
              isCurrency
            />
          )}
          <KpiComparisonCard
            label="Leads recebidos"
            value={commercial.conversion.received}
            sublabel={`Nos últimos ${period} dias`}
            icon={Users}
            iconClassName="bg-chart-1/10 text-chart-1"
          />
        </div>
      </section>

      <FunnelSection funnel={funnel} />

      <AttentionSection attention={attention} period={period} />
    </>
  );
}
