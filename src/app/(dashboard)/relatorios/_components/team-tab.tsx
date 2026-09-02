import type { PeriodValue } from "@/shared/period";
import type { BrokerPerformanceRow } from "@/features/reports/metrics/metrics-service";
import { Users } from "@/components/huge-icons";

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
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
            <Users className="mx-auto mb-2 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum dado de equipe disponível para este período.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Corretor</th>
                  <th className="px-4 py-3 text-right">Recebidos</th>
                  <th className="px-4 py-3 text-right">Convertidos</th>
                  <th className="px-4 py-3 text-right">Conversão</th>
                  <th className="px-4 py-3 text-right">SLA 1º contato</th>
                  <th className="px-4 py-3 text-right">Parados</th>
                  <th className="px-4 py-3 text-right">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {teamPerformance.map((row) => (
                  <tr key={row.brokerId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium" title={row.brokerId}>{row.brokerName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.received}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.converted}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.conversionRate.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.slaRate.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {row.stagnant > 0 ? (
                        <span className="text-red-600 font-medium">{row.stagnant}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{row.sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
