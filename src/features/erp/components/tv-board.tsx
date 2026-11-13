"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime, monthLabel } from "../analytics-core";
import type { TvTile } from "../tv";

const REFRESH_MS = 5 * 60 * 1000;
const STALE_MS = 2 * REFRESH_MS + 60 * 1000;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** Rotates server-rendered aggregated tiles. Data comes only from the authenticated server render; on error the boundary unmounts this and the timers stop. */
export function TvBoard({ tiles, intervalSeconds, generatedAt, month }: { tiles: TvTile[]; intervalSeconds: number; generatedAt: string; month: string }) {
  const router = useRouter();
  const container = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stale, setStale] = useState(false);
  const current = tiles.length ? tiles[index % tiles.length] : null;

  useEffect(() => {
    if (paused || tiles.length < 2) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % tiles.length), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, tiles.length, intervalSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    const check = () => setStale(Date.now() - new Date(generatedAt).getTime() > STALE_MS);
    check();
    const timer = window.setInterval(check, 30 * 1000);
    return () => window.clearInterval(timer);
  }, [generatedAt]);

  function fullScreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen?.();
  }

  const animation = reducedMotion ? "" : "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500";
  const selectTile = (position: number) => {
    setIndex(position);
    setPaused(true);
  };

  // Type scale of docs/design-system.md only: display 48px (Satoshi slot, >=36px) for the number, heading 30px / heading-sm 24px for text.
  return <section ref={container} aria-label="Modo TV" aria-roledescription="apresentação"
    className="flex min-h-[70vh] flex-col gap-ds-24 rounded-ds-large-cards border border-border bg-background p-ds-24 sm:p-ds-40">
    <header className="flex flex-wrap items-center justify-between gap-ds-12">
      <div>
        <p className="text-ds-body text-muted-foreground">{monthLabel(month)}</p>
        <p className="text-ds-body text-muted-foreground" aria-live="polite">
          Atualizado em {formatDateTime(generatedAt)}{stale ? " · atualização atrasada" : ""}
        </p>
      </div>
      <div className="flex gap-ds-8">
        <Button type="button" variant="outline" onClick={() => setPaused((value) => !value)} aria-pressed={paused}>{paused ? "Retomar" : "Pausar"}</Button>
        <Button type="button" variant="outline" onClick={fullScreen}>Tela cheia</Button>
      </div>
    </header>
    {current ? <div key={current.id} className={`flex flex-1 flex-col justify-center gap-ds-16 ${animation}`} aria-live={paused ? "polite" : "off"}>
      <h2 className="text-ds-heading-sm font-semibold text-foreground sm:text-ds-heading">{current.label}</h2>
      {current.kind === "number"
        ? <p className="font-ds-satoshi text-ds-display font-medium tracking-ds-satoshi tabular-nums text-foreground">{current.value}</p>
        : <ol className="flex flex-col gap-ds-12">
          {current.items.map((item, position) => <li key={`${item.label}-${position}`}
            className="flex items-baseline justify-between gap-ds-24 border-b border-border pb-ds-12 text-ds-heading-sm sm:text-ds-heading">
            <span className="text-foreground"><span className="mr-ds-16 tabular-nums text-muted-foreground">{position + 1}º</span>{item.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
          </li>)}
        </ol>}
      <p className="text-ds-body-lg text-muted-foreground">{current.hint}</p>
    </div> : <div className="flex flex-1 items-center justify-center text-ds-body text-muted-foreground">Nenhum indicador liberado para exibição.</div>}
    {tiles.length > 1 ? <nav aria-label="Indicadores" className="flex flex-wrap justify-center gap-ds-8">
      {tiles.map((tile, position) => {
        const active = position === index % tiles.length;
        return <Button key={tile.id} type="button" size="sm" variant={active ? "secondary" : "ghost"} aria-current={active ? "true" : undefined}
          onClick={() => selectTile(position)}>{tile.label}</Button>;
      })}
    </nav> : null}
  </section>;
}
