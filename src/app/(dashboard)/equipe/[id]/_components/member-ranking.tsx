import { acceptRate, formatDuration, RANK_LABEL, type BrokerOfferStats, type RankPosition } from "@/features/engagement/ranking";

/** Speed and position of the broker in the company over the last days (rolling week). */
export function MemberRankingPanel({ stats, ranks, periodDays, withoutStep }: { stats: BrokerOfferStats | null; ranks: RankPosition[]; periodDays: number; withoutStep: number }) {
  const rate = stats && stats.offered ? Math.round(acceptRate(stats) * 100) : null;
  return (
    <section aria-label="Velocidade e ranking" className="rounded-[var(--radius-card-lg,16px)] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Velocidade e ranking</h2>
        <span className="text-xs text-muted-foreground">Últimos {periodDays} dias</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted-foreground">Tempo para aceitar</dt><dd className="mt-1 font-mono text-base font-semibold tabular-nums">{formatDuration(stats?.medianAcceptSeconds ?? null)}</dd></div>
        <div><dt className="text-muted-foreground">Ofertas x aceitas</dt><dd className="mt-1 font-mono text-base font-semibold tabular-nums">{stats ? `${stats.accepted}/${stats.offered}` : "0/0"}</dd></div>
        <div><dt className="text-muted-foreground">Taxa de aceite</dt><dd className="mt-1 font-mono text-base font-semibold tabular-nums">{rate === null ? "sem dado" : `${rate}%`}</dd></div>
      </dl>
      {ranks.length ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {ranks.map((rank) => (
            <li key={rank.key} className="flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{RANK_LABEL[rank.key].replace(/^n[oa]s? /, "").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
              <span className={`font-mono font-semibold tabular-nums ${rank.position <= 3 ? "text-success" : ""}`}>{rank.position}º de {rank.total}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Ainda sem ofertas suficientes para o ranking.</p>
      )}
      <p className={`mt-4 text-xs ${withoutStep ? "text-warning" : "text-muted-foreground"}`}>
        {withoutStep ? `${withoutStep} ${withoutStep === 1 ? "lead aceito está" : "leads aceitos estão"} sem etapa registrada.` : "Todos os leads aceitos têm etapa registrada."}
      </p>
    </section>
  );
}
