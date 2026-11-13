"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import page from "@/components/lite/page/lite-page.module.css";
import { formatCompetence } from "../ui/format";
import { useErpSkin } from "../ui/skin-context";
import type { TvTile } from "../tv";
import styles from "./tv-board.module.css";

const REFRESH_MS = 5 * 60 * 1000;
const STALE_MS = 2 * REFRESH_MS + 60 * 1000;
/** Rankings visible at once; more than this rotates between pages of rankings (numbers never rotate). */
const RANKINGS_PER_VIEW = 2;

type NumberTile = Extract<TvTile, { kind: "number" }>;
type RankingTile = Extract<TvTile, { kind: "ranking" }>;

const time = (iso: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const monthTitle = (month: string) => formatCompetence(month, "long").replace(/^./, (letter) => letter.toUpperCase());

function Ranking({ tile }: { tile: RankingTile }) {
  const top = Math.max(1, ...tile.items.map((item) => item.amount ?? 0));
  return <section className={styles.ranking} aria-label={tile.label}>
    <h2 className={styles.label}>{tile.label}</h2>
    <ol className={styles.list}>
      {tile.items.map((item, position) => <li key={`${item.label}-${position}`} className={styles.item}>
        <span className={styles.position}>{position + 1}º</span>
        <span className={styles.name}>{item.label}</span>
        <span className={styles.amount}>{item.value}</span>
        <span className={styles.bar} aria-hidden="true"><span className={styles.fill} style={{ width: `${Math.round(((item.amount ?? 0) / top) * 100)}%` }} /></span>
      </li>)}
    </ol>
    <p className={styles.hint}>{tile.hint}</p>
  </section>;
}

/**
 * Wallboard of the month: every number tile at once, rankings with bars. Data comes only from the authenticated server
 * render and refreshes every 5 minutes; on error the boundary unmounts this and the timers stop.
 */
export function TvBoard({ tiles, intervalSeconds, generatedAt, month }: { tiles: TvTile[]; intervalSeconds: number; generatedAt: string; month: string }) {
  const router = useRouter();
  const skin = useErpSkin();
  const container = useRef<HTMLElement>(null);
  const [view, setView] = useState(0);
  const [paused, setPaused] = useState(false);
  const [stale, setStale] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const numbers = tiles.filter((tile): tile is NumberTile => tile.kind === "number");
  const rankings = tiles.filter((tile): tile is RankingTile => tile.kind === "ranking");
  const views = Math.max(1, Math.ceil(rankings.length / RANKINGS_PER_VIEW));
  const rotating = views > 1;
  const start = (view % views) * RANKINGS_PER_VIEW;
  const shown = rankings.slice(start, start + RANKINGS_PER_VIEW);

  useEffect(() => {
    if (paused || !rotating) return;
    const timer = window.setInterval(() => setView((value) => (value + 1) % views), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, rotating, views, intervalSeconds]);

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

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen?.();
  }

  const lite = skin === "lite";
  const control = (label: string, onClick: () => void, pressed?: boolean) => lite
    ? <button type="button" className={page.button} onClick={onClick} aria-pressed={pressed}>{label}</button>
    : <Button type="button" variant="outline" onClick={onClick} aria-pressed={pressed}>{label}</Button>;

  return <section ref={container} aria-label="Modo TV" data-skin={skin} className={styles.board}>
    <header className={styles.top}>
      <div className={styles.period}>
        <p className={styles.month}>{monthTitle(month)}</p>
        <p className={styles.updated} data-stale={stale} aria-live="polite">
          Atualizado às {time(generatedAt)}{stale ? ", atualização atrasada" : ""}
        </p>
      </div>
      <div className={styles.controls}>
        {rotating ? control(paused ? "Retomar" : "Pausar", () => setPaused((value) => !value), paused) : null}
        {control(fullscreen ? "Sair da tela cheia" : "Tela cheia", toggleFullscreen)}
      </div>
    </header>
    {tiles.length ? <div className={styles.content}>
      {numbers.length ? <div className={styles.numbers}>
        {numbers.map((tile) => <article key={tile.id} className={styles.tile} aria-label={tile.label}>
          <h2 className={styles.label}>{tile.label}</h2>
          <p className={styles.value}>{tile.value}</p>
          <p className={styles.hint}>{tile.hint}</p>
        </article>)}
      </div> : null}
      {shown.length ? <div key={view % views} className={`${styles.rankings} ${rotating ? styles.swap : ""}`} aria-live={rotating && paused ? "polite" : "off"}>
        {shown.map((tile) => <Ranking key={tile.id} tile={tile} />)}
      </div> : null}
    </div> : <div className={styles.empty}>Nenhum indicador liberado para exibição.</div>}
  </section>;
}
