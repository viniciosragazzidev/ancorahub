import { cn } from "@/lib/utils";

export type Temperature = "hot" | "warm" | "cold";

/** Quente / morno / frio: the same reading of a lead's temperature across the profile. */
export const TEMPERATURE_UI: Record<Temperature, { label: string; dot: string; bar: string; text: string }> = {
  hot: { label: "Quentes", dot: "bg-destructive", bar: "bg-destructive", text: "text-destructive" },
  warm: { label: "Mornos", dot: "bg-warning", bar: "bg-warning", text: "text-warning" },
  cold: { label: "Frios", dot: "bg-info", bar: "bg-info", text: "text-info" },
};

/** How many hot, warm and cold leads the broker received, as numbers and one proportion bar. */
export function MemberTemperaturePanel({ counts }: { counts: { hot: number; warm: number; cold: number; unknown: number } }) {
  const total = counts.hot + counts.warm + counts.cold;
  const keys = Object.keys(TEMPERATURE_UI) as Temperature[];
  return (
    <section aria-label="Temperatura dos leads" className="rounded-[var(--radius-card-lg,16px)] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Temperatura dos leads</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{total} qualificados{counts.unknown ? ` · ${counts.unknown} sem temperatura` : ""}</span>
      </div>
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={keys.map((key) => `${counts[key]} ${TEMPERATURE_UI[key].label.toLocaleLowerCase("pt-BR")}`).join(", ")}>
        {total ? keys.map((key) => counts[key] ? <span key={key} className={cn("h-full", TEMPERATURE_UI[key].bar)} style={{ width: `${(counts[key] / total) * 100}%` }} /> : null) : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <div key={key} className="rounded-[var(--radius-card)] border border-border/70 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden="true" className={cn("size-2 rounded-full", TEMPERATURE_UI[key].dot)} />{TEMPERATURE_UI[key].label}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">{counts[key]}</dd>
            <dd className="text-[11px] text-muted-foreground tabular-nums">{total ? Math.round((counts[key] / total) * 100) : 0}%</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Offers sent to the broker against offers accepted, with the acceptance rate. */
export function MemberOffersPanel({ offers }: { offers: { total: number; accepted: number; pending: number; declined: number; expired: number } }) {
  const answered = offers.total - offers.pending;
  const rate = answered > 0 ? Math.round((offers.accepted / answered) * 100) : null;
  return (
    <section aria-label="Ofertas" className="rounded-[var(--radius-card-lg,16px)] border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Ofertas enviadas x aceitas</h2>
        <span className="text-xs text-muted-foreground">{rate === null ? "Sem respostas ainda" : `${rate}% de aceite`}</span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="font-mono text-3xl font-semibold tabular-nums">{offers.accepted}<span className="text-lg text-muted-foreground">/{offers.total}</span></p>
        <p className="pb-1 text-xs text-muted-foreground">aceitas de enviadas</p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${offers.accepted} de ${offers.total} ofertas aceitas`}>
        <span className="block h-full rounded-full bg-success" style={{ width: `${offers.total ? (offers.accepted / offers.total) * 100 : 0}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted-foreground">Recusadas</dt><dd className="font-mono text-base font-semibold tabular-nums">{offers.declined}</dd></div>
        <div><dt className="text-muted-foreground">Expiradas</dt><dd className="font-mono text-base font-semibold tabular-nums">{offers.expired}</dd></div>
        <div><dt className="text-muted-foreground">Pendentes</dt><dd className="font-mono text-base font-semibold tabular-nums">{offers.pending}</dd></div>
      </dl>
    </section>
  );
}
