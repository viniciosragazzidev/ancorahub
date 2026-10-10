"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotionConfig } from "motion/react";

import type { JourneyCelebration } from "@/features/engagement/journey-types";

import { BadgeArt } from "./badge-art";
import { Confetti } from "./confetti";
import { LevelRing } from "./level-ring";
import styles from "./celebration-layer.module.css";

/** How long the small "+15" toast stays before leaving on its own. */
export const POINTS_TOAST_MS = 3200;
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const isBig = (item: JourneyCelebration) => item.kind === "mission" || item.kind === "achievement" || item.kind === "level";

/**
 * Orders what to show: big moments first (mission, level, achievement), then
 * points by priority and time. Daily summaries never pop up (they go to the
 * Jornada conversation).
 */
export function orderCelebrations(items: JourneyCelebration[]) {
  return items
    .filter((item) => !item.seenAt && item.kind !== "daily_summary")
    .sort((a, b) => Number(isBig(b)) - Number(isBig(a)) || b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Shows the broker's celebrations one at a time. `blocked` holds everything
 * while a lead offer or an SLA alert is on screen (an offer always wins).
 * `onSeen` marks one as shown (the server sets seen_at, never twice).
 */
export function CelebrationLayer({ items, blocked = false, onSeen }: { items: JourneyCelebration[]; blocked?: boolean; onSeen: (ids: string[]) => void }) {
  const queue = useMemo(() => orderCelebrations(items), [items]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const pending = queue.filter((item) => !done.has(item.id));
  const current = blocked ? null : pending[0] ?? null;

  function finish(item: JourneyCelebration) {
    setDone((previous) => new Set(previous).add(item.id));
    onSeen([item.id]);
  }

  return (
    <>
      <AnimatePresence>
        {current && !isBig(current) ? <PointsToast key={current.id} item={current} queued={pending.length - 1} onDone={() => finish(current)} /> : null}
      </AnimatePresence>
      <AnimatePresence>
        {current && isBig(current) ? <BigMoment key={current.id} item={current} queued={pending.length - 1} onDone={() => finish(current)} /> : null}
      </AnimatePresence>
    </>
  );
}

function PointsToast({ item, queued, onDone }: { item: JourneyCelebration; queued: number; onDone: () => void }) {
  const reduce = useReducedMotionConfig();
  const payload = item.payload.kind === "points" ? item.payload : null;
  const [shown, setShown] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  // The number counts up once, then the toast leaves by itself.
  useEffect(() => {
    if (!payload) return;
    const target = payload.points;
    if (reduce) { setShown(target); } else {
      const started = performance.now();
      let frame = 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / 650);
        setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      const timer = window.setTimeout(() => doneRef.current(), POINTS_TOAST_MS);
      return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
    }
    const timer = window.setTimeout(() => doneRef.current(), POINTS_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [payload, reduce, queued]);

  if (!payload) return null;
  return (
    <div className={styles.toastLayer} aria-live="polite">
      <motion.button
        type="button"
        className={styles.toast}
        onClick={onDone}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.2 } }}
        transition={reduce ? { duration: 0.1 } : { type: "spring", stiffness: 420, damping: 30 }}
        aria-label={`Mais ${payload.points} pontos: ${payload.label}. Toque para fechar.`}
      >
        <span className={styles.toastPoints}>+{shown}</span>
        <span className={styles.toastText}>
          <strong>{payload.label}</strong>
          <small>{queued > 0 ? `e mais ${queued} na fila` : "pontos na sua jornada"}</small>
        </span>
        {!reduce ? <Sparks /> : null}
      </motion.button>
    </div>
  );
}

/** Six small sparks that burst once from the number. */
function Sparks() {
  const sparks = [0, 60, 120, 180, 240, 300];
  return (
    <span className={styles.sparks} aria-hidden="true">
      {sparks.map((angle) => (
        <motion.i
          key={angle}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: Math.cos((angle * Math.PI) / 180) * 26, y: Math.sin((angle * Math.PI) / 180) * 26, scale: 0.4 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        />
      ))}
    </span>
  );
}

function BigMoment({ item, queued, onDone }: { item: JourneyCelebration; queued: number; onDone: () => void }) {
  const reduce = useReducedMotionConfig();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone, reduce]);

  const payload = item.payload;
  const copy = payload.kind === "mission"
    ? { title: "Missão concluída", detail: `${payload.title}. +${payload.bonusPoints} pts de bônus.` }
    : payload.kind === "achievement"
      ? { title: `Conquista: ${payload.name}`, detail: "O selo já está na sua jornada." }
      : payload.kind === "level"
        ? { title: `Você agora é ${payload.level.name}`, detail: `${payload.totalPoints.toLocaleString("pt-BR")} pts no total. Siga assim.` }
        : null;
  if (!copy) return null;

  return (
    <motion.div className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.1 : 0.25 }} onClick={onDone}>
      {!reduce ? <Confetti seed={item.id.length + 1} /> : null}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`celebration-${item.id}`}
        className={`arc-venancor ${styles.card}`}
        data-kind={payload.kind}
        onClick={(event) => event.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.18 } }}
        transition={reduce ? { duration: 0.1 } : { type: "spring", stiffness: 300, damping: 26 }}
      >
        <motion.div className={styles.art} initial={reduce ? false : { scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 14, delay: 0.12 }}>
          <span className={styles.glow} aria-hidden="true" />
          {payload.kind === "achievement" ? <BadgeArt badge={payload.badgeKey} earned size={120} /> : null}
          {payload.kind === "level" ? <LevelRing index={payload.level.index} percentage={100} size={120} /> : null}
          {payload.kind === "mission" ? (
            <span className={styles.missionArt}>
              <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><motion.path d="M5 12l4 4 10-10" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.35, ease: EASE }} /></svg>
            </span>
          ) : null}
        </motion.div>
        <h2 id={`celebration-${item.id}`} className={styles.title}>{copy.title}</h2>
        <p className={styles.detail}>{copy.detail}</p>
        <button ref={button} type="button" className={styles.continue} onClick={onDone}>
          {queued > 0 ? `Continuar (mais ${queued})` : "Continuar"}
        </button>
      </motion.div>
    </motion.div>
  );
}
