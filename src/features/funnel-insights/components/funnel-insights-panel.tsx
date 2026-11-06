import type { CountRow, FunnelStep } from "@/features/funnel-insights/insights-core";
import { biggestDrop, headline } from "@/features/funnel-insights/insights-core";
import type { FunnelInsights } from "@/features/funnel-insights/queries";

const pct = (value: number) => `${Math.round(value * 100)}%`;

function Bars({ rows, empty }: { rows: CountRow[]; empty: string }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <ul className="grid gap-2">
      {rows.slice(0, 6).map((row) => (
        <li key={row.key} className="grid gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{row.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{row.count} · {pct(row.share)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-ds-electric-blue/70" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Funil profissional (05/11): a maior perda numa frase, onde param na qualificação, onde perdemos e a qualidade por
 * campanha. Só leitura; tudo é calculado sozinho a partir do que o sistema já registra.
 */
export function FunnelInsightsPanel({ insights, steps }: { insights: FunnelInsights; steps: readonly FunnelStep[] }) {
  const sentence = headline({ drop: biggestDrop(steps), topQuestion: insights.stoppedAt[0] ?? null, topLossStage: insights.lostAtStage[0] ?? null });
  return (
    <div className="grid gap-4" aria-label="Onde os clientes param">
      {sentence ? (
        <p role="status" className="rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-sm font-medium text-foreground">{sentence}</p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Onde param na qualificação" hint={`${insights.stoppedTotal} ${insights.stoppedTotal === 1 ? "lead parou" : "leads pararam"} antes de terminar; primeira pergunta que ficou sem resposta.`}>
          <Bars rows={insights.stoppedAt} empty="Ninguém parou na qualificação neste período." />
        </Card>
        <Card title="Onde perdemos" hint="Etapa em que o lead estava ao ser perdido, e os motivos mais comuns.">
          <Bars rows={insights.lostAtStage} empty="Nenhuma perda neste período." />
          {insights.lossReasons.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Motivos de perda">
              {insights.lossReasons.slice(0, 5).map((reason) => (
                <li key={reason.key} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{reason.label} · {reason.count}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
      <Card title="Qualidade por campanha" hint="Quantos leads cada campanha trouxe, quantos ficaram quentes ou mornos e quantos viraram venda.">
        {insights.campaigns.length ? (
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Campanha</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Leads</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Qualificados</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {insights.campaigns.slice(0, 10).map((campaign) => (
                  <tr key={campaign.key} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[16rem] truncate px-4 py-2 text-foreground">{campaign.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{campaign.leads}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{campaign.qualified} <span className="text-muted-foreground">({pct(campaign.qualifiedRate)})</span></td>
                    <td className="px-4 py-2 text-right tabular-nums">{campaign.sales} <span className="text-muted-foreground">({pct(campaign.saleRate)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-muted-foreground">Nenhum lead neste período.</p>}
      </Card>
    </div>
  );
}
