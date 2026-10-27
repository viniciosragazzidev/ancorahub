"use client";

/**
 * Status vivo (plano 2026-10-27-status-vivos): uma peça só para tudo que o sistema faz sozinho.
 * Rótulo + número + próximo evento com contagem + barra da janela + frase do porquê + ação.
 * Movimento conforme motion-e-acabamento.md: número que muda anima a diferença e pulsa uma vez; gravidade que sobe
 * pulsa uma vez e troca a cor em 120 ms; a contagem só troca o texto e, ao chegar a zero, pulsa uma vez e vira
 * "Rodando agora" (decisão do Vinicios, 27/10). Nada em loop. Movimento reduzido: só opacidade, número direto.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LiteAttention, LiteNumber, LiteProgress, LiteStagger, LiteSwap } from "@/components/lite/motion";

import { formatAbsoluteTime, formatAgo, formatCountdown } from "./format";
import styles from "./live-status.module.css";
import type { LiveSeal, LiveSeverity, LiveStatus } from "./types";
import { useCountdown, useNowSeconds } from "./use-countdown";

export type { LiveSeal, LiveSeverity, LiveStatus, LiveStatusEvent } from "./types";

const SEVERITY_RANK: Record<LiveSeverity, number> = { ok: 0, info: 1, atencao: 2, critico: 3 };
const SEVERITY_LABEL: Record<LiveSeverity, string> = { ok: "Normal", info: "Informação", atencao: "Atenção", critico: "Crítico" };

/** Ids que já contaram de zero nesta sessão da página: depois disso, o número só anima a diferença. */
const countedIds = new Set<string>();

/** Pulso único quando o valor observado muda depois da primeira pintura (nunca na montagem). */
function usePulseOn<T>(value: T, shouldPulse: (previous: T, next: T) => boolean = (previous, next) => previous !== next) {
  const previous = useRef(value);
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (shouldPulse(previous.current, value)) setPulse((count) => count + 1);
    previous.current = value;
    // shouldPulse é uma regra fixa de quem chama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return pulse;
}

function NextEventLine({ status, onDue }: { status: LiveStatus; onDue?: (id: string) => void }) {
  const event = status.nextEvent!;
  const remaining = useCountdown(event.at);
  const due = remaining !== null && remaining <= 0;
  const absolute = formatAbsoluteTime(event.at, status.generatedAt);
  const duePulse = usePulseOn(due, (previous, next) => !previous && next);
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (!due || notified.current === event.at) return;
    notified.current = event.at;
    onDue?.(status.id);
  }, [due, event.at, onDue, status.id]);

  const text = due
    ? event.dueLabel ?? "Rodando agora"
    : remaining === null
      ? `${event.label} ${absolute}`
      : `${event.label} em ${formatCountdown(remaining)}`;
  return (
    // div, não p: o LiteSwap é um div (p com div dentro quebra a hidratação).
    <div className={styles.next}>
      <LiteAttention pulseKey={duePulse || undefined} className={styles.pulse}>
        <LiteSwap swapKey={due ? "due" : "counting"} className={styles.swap}>
          <span role="timer" aria-live="off" aria-label={`${event.label} ${absolute}`} className={styles.timer}>{text}</span>
        </LiteSwap>
      </LiteAttention>
    </div>
  );
}

function LastEventLine({ status }: { status: LiveStatus }) {
  const event = status.lastEvent!;
  const now = useNowSeconds();
  const text = now === null
    ? `${event.label} ${formatAbsoluteTime(event.at, status.generatedAt)}`
    : `${event.label} ${formatAgo(now - new Date(event.at).getTime())}`;
  return <p className={styles.next}><span className={styles.timer}>{text}</span></p>;
}

function WindowProgress({ status }: { status: LiveStatus }) {
  const event = status.nextEvent!;
  const clock = useNowSeconds();
  const start = new Date(event.windowStartAt!).getTime();
  const end = new Date(event.at).getTime();
  // Sem relógio do cliente ainda, o instante do dado: o mesmo valor no servidor e na hidratação.
  const now = clock ?? new Date(status.generatedAt).getTime();
  if (!(end > start)) return null;
  const value = ((now - start) / (end - start)) * 100;
  return <LiteProgress value={value} label={`Tempo até: ${event.label.toLowerCase()}`} className={styles.progress} />;
}

export interface LiteLiveStatusProps {
  status: LiveStatus;
  /** Chamado uma vez quando a contagem chega a zero (quem hospeda busca o dado novo). */
  onDue?: (id: string) => void;
}

export function LiteLiveStatus({ status, onDue }: LiteLiveStatusProps) {
  const [countFromZero] = useState(() => !countedIds.has(status.id));
  useEffect(() => { countedIds.add(status.id); }, [status.id]);
  const valuePulse = usePulseOn(status.value);
  const severityPulse = usePulseOn(status.severity, (previous, next) => SEVERITY_RANK[next] > SEVERITY_RANK[previous]);
  const hasValue = status.value > 0 || Boolean(status.valueText);

  return (
    <article className={styles.card} data-severity={status.severity} data-stale={status.stale ? "true" : undefined} aria-labelledby={`live-${status.id}`}>
      <header className={styles.head}>
        <LiteAttention pulseKey={severityPulse || undefined} className={styles.dotWrap}>
          <span className={styles.dot} aria-hidden="true" />
        </LiteAttention>
        <h3 id={`live-${status.id}`} className={styles.label}>{status.label}</h3>
        <span className={styles.srOnly}>{SEVERITY_LABEL[status.severity]}</span>
        {status.action ? (
          // Rótulo curto na tela ("Plantão"); o nome acessível diz de qual cartão é ("Plantão: Ofertas aguardando aceite").
          <Link href={status.action.href} className={styles.action} aria-label={`${status.action.label}: ${status.label}`}>
            {status.action.label}
            <span aria-hidden="true" className={styles.arrow}>→</span>
          </Link>
        ) : null}
      </header>
      <div className={styles.valueRow}>
        {hasValue ? (
          <LiteAttention pulseKey={valuePulse || undefined} className={styles.pulse}>
            {status.valueText
              ? <span className={styles.value} aria-live="polite">{status.valueText}</span>
              : <LiteNumber value={status.value} countFromZero={countFromZero} live className={styles.value} />}
          </LiteAttention>
        ) : (
          <p className={styles.empty} aria-live="polite">{status.emptyText}</p>
        )}
      </div>
      {status.nextEvent ? <NextEventLine status={status} onDue={onDue} /> : status.lastEvent ? <LastEventLine status={status} /> : status.note ? <p className={styles.next}>{status.note}</p> : null}
      {status.nextEvent?.windowStartAt ? <WindowProgress status={status} /> : null}
      <p className={styles.explanation}>{status.explanation}</p>
      {status.breakdown?.length ? (
        <ul className={styles.breakdown}>
          {status.breakdown.slice(0, 3).map((item) => (
            <li key={item.label}><span>{item.label}</span> <strong>{item.value}</strong></li>
          ))}
        </ul>
      ) : null}
      {status.stale ? <p className={styles.staleNote}>Sem atualização agora; dado {formatAbsoluteTime(status.generatedAt, status.generatedAt)}.</p> : null}
    </article>
  );
}

/** Selo pequeno da faixa: "Motor de distribuição ativo; última rodada há 40 s; próxima em 01:20". */
export function LiteLiveSeal({ seal }: { seal: LiveSeal }) {
  const now = useNowSeconds();
  const severityPulse = usePulseOn(seal.severity, (previous, next) => SEVERITY_RANK[next] > SEVERITY_RANK[previous]);
  const last = seal.lastRunAt
    ? now === null ? `última rodada ${formatAbsoluteTime(seal.lastRunAt, seal.generatedAt)}` : `última rodada ${formatAgo(now - new Date(seal.lastRunAt).getTime())}`
    : "sem registro de rodada ainda";
  const next = seal.nextRunAt
    ? now === null ? `próxima ${formatAbsoluteTime(seal.nextRunAt, seal.generatedAt)}` : `próxima em ${formatCountdown(new Date(seal.nextRunAt).getTime() - now)}`
    : null;
  const body = (
    <>
      <LiteAttention pulseKey={severityPulse || undefined} className={styles.dotWrap}>
        <span className={styles.dot} aria-hidden="true" />
      </LiteAttention>
      <span className={styles.sealText}>
        <span className={styles.sealLabel}>{seal.label}</span>
        <span className={styles.timer}>{[last, next].filter(Boolean).join("; ")}</span>
        {seal.detail ? <span className={styles.sealDetail}>{seal.detail}</span> : null}
      </span>
    </>
  );
  return seal.action
    ? <Link href={seal.action.href} className={styles.seal} data-severity={seal.severity} aria-label={`${seal.label}. ${seal.action.label}`}>{body}</Link>
    : <div className={styles.seal} data-severity={seal.severity} role="status">{body}</div>;
}

export interface LiteLiveStatusStripProps {
  statuses: LiveStatus[];
  seals?: LiveSeal[];
  title?: string;
  onDue?: (id: string) => void;
  className?: string;
}

/** Faixa "Agora na operação": grade de 2 a 4 colunas, lista no celular. Sem status, não ocupa espaço. */
export function LiteLiveStatusStrip({ statuses, seals = [], title = "Agora na operação", onDue, className }: LiteLiveStatusStripProps) {
  if (!statuses.length && !seals.length) return null;
  return (
    <section className={[styles.strip, className].filter(Boolean).join(" ")} aria-label={title} data-live-status-strip="">
      <header className={styles.stripHead}>
        <h2 className={styles.stripTitle}>{title}</h2>
        {seals.length ? <div className={styles.seals}>{seals.map((seal) => <LiteLiveSeal key={seal.id} seal={seal} />)}</div> : null}
      </header>
      {statuses.length ? (
        <LiteStagger className={styles.grid}>
          {statuses.map((status) => <LiteLiveStatus key={status.id} status={status} onDue={onDue} />)}
        </LiteStagger>
      ) : null}
    </section>
  );
}
