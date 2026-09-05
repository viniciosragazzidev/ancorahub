import type { PeriodValue } from "@/shared/period";
import type { FinancialOverview } from "@/features/reports/metrics/metrics-service";
import { CurrencyCircleDollar, Buildings, Users, ChartBar } from "@/components/huge-icons";
import { DataTableFrame } from "@/components/ui/data-table/data-table-frame";
import { MobileDataList, MobileDataListItem, MobileDataRow, ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <ResponsiveDataView
        desktop={<DataTableFrame><Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title === "Por canal" ? "Canal" : title === "Por corretor" ? "Corretor" : "Unidade"}</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Ticket médio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.sales > 0
                    ? (row.revenue / row.sales).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></DataTableFrame>}
        mobile={
          <MobileDataList>
            {rows.map((row) => (
              <MobileDataListItem key={row.label}>
                <h3 className="mb-2.5 truncate text-sm font-semibold text-foreground">{row.label}</h3>
                <div className="space-y-2">
                  <MobileDataRow label="Vendas" value={row.sales} />
                  <MobileDataRow label="Receita" value={row.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                  <MobileDataRow label="Ticket médio" value={row.sales > 0 ? (row.revenue / row.sales).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} />
                </div>
              </MobileDataListItem>
            ))}
          </MobileDataList>
        }
      />
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
