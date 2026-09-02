import type { PeriodValue } from "@/shared/period";
import type { UnitPerformanceRow } from "@/features/reports/metrics/metrics-service";
import { Buildings } from "@/components/huge-icons";

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
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Convertidos</th>
                <th className="px-4 py-3 text-right">Conversão</th>
                <th className="px-4 py-3 text-right">Vendas</th>
                <th className="px-4 py-3 text-right">SLA 1º contato</th>
              </tr>
            </thead>
            <tbody>
              {units.map((row) => (
                <tr key={row.branchId} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{row.branchName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.leads}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.converted}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.conversionRate.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.sales}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.slaRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
