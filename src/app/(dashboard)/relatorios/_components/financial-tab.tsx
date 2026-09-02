import type { PeriodValue } from "@/shared/period";
import type { FinancialOverview } from "@/features/reports/metrics/metrics-service";
import { CurrencyCircleDollar, Buildings, Users, ChartBar } from "@/components/huge-icons";

interface FinancialTabProps {
  readonly period: PeriodValue;
  readonly financial: FinancialOverview;
}

function SummaryTable({ title, icon: Icon, rows }: { title: string; icon: typeof CurrencyCircleDollar; rows: readonly { label: string; revenue: number; sales: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={`fin-${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        <h2 id={`fin-${title.toLowerCase().replace(/\s+/g, "-")}-title`} className="font-medium text-foreground">{title}</h2>
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">{title === "Por canal" ? "Canal" : title === "Por corretor" ? "Corretor" : "Unidade"}</th>
              <th className="px-4 py-3 text-right">Vendas</th>
              <th className="px-4 py-3 text-right">Receita</th>
              <th className="px-4 py-3 text-right">Ticket médio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.sales}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.sales > 0
                    ? (row.revenue / row.sales).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FinancialTab({ period, financial }: FinancialTabProps) {
  return (
    <>
      <section aria-labelledby="financial-overview-title">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <CurrencyCircleDollar className="size-3.5" aria-hidden="true" />
          <h2 id="financial-overview-title" className="font-medium text-foreground">Resumo financeiro</h2>
          <span aria-hidden="true">•</span>
          <span>Últimos {period} dias</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {financial.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs text-muted-foreground">Receita total</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{financial.sales}</p>
            <p className="text-xs text-muted-foreground">Vendas</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {financial.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs text-muted-foreground">Ticket médio</p>
          </div>
        </div>
      </section>

      <SummaryTable title="Por unidade" icon={Buildings} rows={financial.byUnit} />
      <SummaryTable title="Por corretor" icon={Users} rows={financial.byBroker} />
      <SummaryTable title="Por canal" icon={ChartBar} rows={financial.bySource} />
    </>
  );
}
