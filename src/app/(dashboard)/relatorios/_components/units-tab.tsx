import type { PeriodValue } from "@/shared/period";
import type { UnitPerformanceRow } from "@/features/reports/metrics/metrics-service";
import { Buildings } from "@/components/huge-icons";
import { DataTableFrame } from "@/components/ui/data-table/data-table-frame";
import { MobileDataList, MobileDataListItem, MobileDataRow, ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UnitsTabProps {
  readonly period: PeriodValue;
  readonly units: readonly UnitPerformanceRow[];
}

export function UnitsTab({ period, units }: UnitsTabProps) {
  return (
    <section aria-labelledby="units-title">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Buildings className="size-3.5" aria-hidden="true" />
        <h2 id="units-title" className="font-medium text-foreground">Desempenho por unidade</h2>
        <span aria-hidden="true">•</span>
        <span>Últimos {period} dias</span>
      </div>

      {units.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <Buildings className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum dado de unidade disponível para este período.</p>
        </div>
      ) : (
        <ResponsiveDataView
          desktop={<DataTableFrame><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">SLA 1º contato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((row) => (
                <TableRow key={row.branchId}>
                  <TableCell className="font-medium">{row.branchName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.converted}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.conversionRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.slaRate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></DataTableFrame>}
          mobile={
            <MobileDataList>
              {units.map((row) => (
                <MobileDataListItem key={row.branchId}>
                  <h3 className="mb-2.5 truncate text-sm font-semibold text-foreground">{row.branchName}</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <MobileDataRow label="Leads" value={row.leads} />
                    <MobileDataRow label="Convertidos" value={row.converted} />
                    <MobileDataRow label="Conversão" value={`${row.conversionRate.toFixed(1)}%`} />
                    <MobileDataRow label="Vendas" value={row.sales} />
                    <MobileDataRow className="col-span-2" label="SLA 1º contato" value={`${row.slaRate.toFixed(1)}%`} />
                  </div>
                </MobileDataListItem>
              ))}
            </MobileDataList>
          }
        />
      )}
    </section>
  );
}
