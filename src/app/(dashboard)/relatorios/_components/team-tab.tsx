import type { PeriodValue } from "@/shared/period";
import type { BrokerPerformanceRow } from "@/features/reports/metrics/metrics-service";
import { Users } from "@/components/huge-icons";
import { DataTableFrame } from "@/components/ui/data-table/data-table-frame";
import { MobileDataList, MobileDataListItem, MobileDataRow, ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TeamTabProps {
  readonly period: PeriodValue;
  readonly teamPerformance: readonly BrokerPerformanceRow[] | null;
}

export function TeamTab({ period, teamPerformance }: TeamTabProps) {
  return (
    <>
      <section aria-labelledby="team-title">
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          <h2 id="team-title" className="font-medium text-foreground">Desempenho da equipe</h2>
          <span aria-hidden="true">•</span>
          <span>Últimos {period} dias</span>
        </div>

        {!teamPerformance || teamPerformance.length === 0 ? (
          <div data-slot="report-card" className="report-card rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum dado de equipe disponível para este período.</p>
          </div>
        ) : (
          <ResponsiveDataView
            desktop={<DataTableFrame data-slot="report-card" className="report-card"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corretor</TableHead>
                  <TableHead className="text-right">Recebidos</TableHead>
                  <TableHead className="text-right">Convertidos</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">SLA 1º contato</TableHead>
                  <TableHead className="text-right">Parados</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamPerformance.map((row) => (
                  <TableRow key={row.brokerId}>
                    <TableCell className="font-medium" title={row.brokerId}>{row.brokerName}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.received}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.converted}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.conversionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{row.slaRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.stagnant > 0 ? (
                        <span className="text-red-600 font-medium">{row.stagnant}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></DataTableFrame>}
            mobile={
              <MobileDataList>
                {teamPerformance.map((row) => (
                  <MobileDataListItem key={row.brokerId}>
                    <h3 className="mb-2.5 truncate text-sm font-semibold text-foreground">{row.brokerName}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <MobileDataRow label="Recebidos" value={row.received} />
                      <MobileDataRow label="Convertidos" value={row.converted} />
                      <MobileDataRow label="Conversão" value={`${row.conversionRate.toFixed(1)}%`} />
                      <MobileDataRow label="SLA 1º contato" value={`${row.slaRate.toFixed(1)}%`} />
                      <MobileDataRow label="Parados" value={<span className={row.stagnant > 0 ? "text-destructive" : undefined}>{row.stagnant}</span>} />
                      <MobileDataRow label="Vendas" value={row.sales} />
                    </div>
                  </MobileDataListItem>
                ))}
              </MobileDataList>
            }
          />
        )}
      </section>
    </>
  );
}
