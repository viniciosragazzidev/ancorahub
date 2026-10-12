"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import styles from "./chat.module.css";
import type { ChatBlock, ChatBlockIcon, ChatLeadRow } from "./types";

const ease = [0.165, 0.84, 0.44, 1] as const;

const ICON: Record<ChatBlockIcon, string> = {
  leads: "M8 2.5a4 4 0 0 0-4 4v2.2L2.8 11h10.4L12 8.7V6.5a4 4 0 0 0-4-4ZM6.5 13a1.5 1.5 0 0 0 3 0",
  reply: "M3 4.5h10v6H8l-3 2.5v-2.5H3z",
  agenda: "M4 2.5v2M12 2.5v2M2.8 6.5h10.4M3.5 4h9a.7.7 0 0 1 .7.7v8.1a.7.7 0 0 1-.7.7h-9a.7.7 0 0 1-.7-.7V4.7a.7.7 0 0 1 .7-.7Z",
  day: "M3 13V9M6.3 13V6M9.6 13V8M13 13V3.5",
};

function BlockIcon({ icon }: { icon: ChatBlockIcon }) {
  return (
    <span className={styles.liveIcon} aria-hidden="true">
      <svg viewBox="0 0 16 16" width="16" height="16"><path d={ICON[icon]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/** Counts up from zero when the block arrives (instant with reduced motion). */
function useCountUp(value: number) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce || value === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, value]);
  return reduce ? value : shown;
}

function Tile({ label, value, tone, index }: { label: string; value: number; tone?: string; index: number }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(value);
  return (
    <motion.div
      className={styles.liveTile}
      data-tone={value > 0 ? tone ?? "neutral" : "neutral"}
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.24, delay: reduce ? 0 : 0.05 + index * 0.05, ease }}
    >
      <span className={styles.liveTileValue}>{shown}</span>
      <span className={styles.liveTileLabel}>{label}</span>
    </motion.div>
  );
}

function Updated({ at }: { at: string }) {
  return <p className={styles.liveUpdated}>Atualizado às {at}</p>;
}

type LiveBlock = Extract<ChatBlock, { type: "leads" | "stats" | "leadcard" }>;

/**
 * Data blocks brought by "@": a list of leads (tap a row for its quick card),
 * the numbers of the day, and the quick card of one lead with one-tap actions.
 */
export function LiveBlockView({ block, onLeadOpen }: { block: LiveBlock; onLeadOpen?: (row: ChatLeadRow) => void }) {
  const reduce = useReducedMotion();
  switch (block.type) {
    case "leads":
      return (
        <section className={`${styles.card} ${styles.liveCard}`} aria-label={block.title}>
          <header className={styles.liveHeader}>
            <BlockIcon icon={block.icon} />
            <span className={styles.cardTitle}>{block.title}</span>
            <span className={styles.liveCount}>{block.rows.length}</span>
          </header>
          {block.rows.length ? (
            <ul className={styles.liveRows}>
              {block.rows.map((row, index) => (
                <motion.li
                  key={row.leadId}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: reduce ? 0 : 0.06 + Math.min(index, 8) * 0.04, ease }}
                >
                  <button type="button" className={styles.liveRow} onClick={() => onLeadOpen?.(row)} aria-label={`Ver ${row.name}`}>
                    <span className={styles.liveAvatar} aria-hidden="true">{row.initials}</span>
                    <span className={styles.liveRowText}>
                      <span className={styles.liveRowName}>{row.name}</span>
                      <span className={styles.liveRowContext}>{row.context}</span>
                    </span>
                    <span className={styles.liveRowSide}>
                      {row.chip ? <span className={styles.liveChip} data-tone={row.chip.tone}>{row.chip.label}</span> : null}
                      {row.time ? <span className={styles.liveRowTime}>{row.time}</span> : null}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          ) : <p className={styles.liveEmpty}>{block.emptyText}</p>}
          <Updated at={block.updatedAt} />
        </section>
      );
    case "stats":
      return (
        <section className={`${styles.card} ${styles.liveCard}`} aria-label={block.title}>
          <header className={styles.liveHeader}>
            <BlockIcon icon={block.icon} />
            <span className={styles.cardTitle}>{block.title}</span>
          </header>
          <div className={styles.liveTiles}>
            {block.tiles.map((tile, index) => <Tile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} index={index} />)}
          </div>
          {block.goal ? (
            <div className={styles.liveGoal}>
              <div className={styles.liveGoalHead}>
                <span>{block.goal.name}</span>
                <span className={styles.liveGoalValue}>{block.goal.current} de {block.goal.target}</span>
              </div>
              <div className={styles.liveGoalTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(block.goal.percentage)} aria-label={block.goal.name}>
                <motion.span
                  className={styles.liveGoalFill}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: Math.min(100, Math.max(0, block.goal.percentage)) / 100 }}
                  transition={{ type: "spring", visualDuration: 0.7, bounce: 0, delay: reduce ? 0 : 0.25 }}
                />
              </div>
            </div>
          ) : null}
          <Updated at={block.updatedAt} />
        </section>
      );
    case "leadcard": {
      const external = (href: string) => /^https?:/.test(href);
      return (
        <section className={`${styles.card} ${styles.liveCard}`} aria-label={`Ficha de ${block.name}`}>
          <header className={styles.leadCardHeader}>
            <motion.span
              className={`${styles.liveAvatar} ${styles.leadCardAvatar}`}
              aria-hidden="true"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", visualDuration: 0.35, bounce: 0.3 }}
            >
              {block.initials}
            </motion.span>
            <span className={styles.liveRowText}>
              <span className={styles.leadCardName}>{block.name}</span>
              <span className={styles.liveRowContext}>{block.stage}</span>
            </span>
          </header>
          {block.alert ? (
            <motion.p
              className={styles.leadCardAlert}
              data-tone={block.alert.tone}
              role="status"
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : 0.12, ease }}
            >
              {block.alert.text}
            </motion.p>
          ) : null}
          <dl className={styles.leadCardFacts}>
            {block.rows.map((row, index) => (
              <motion.div
                key={row.label}
                className={styles.leadCardFact}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: reduce ? 0 : 0.16 + index * 0.03 }}
              >
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </motion.div>
            ))}
          </dl>
          <div className={styles.leadCardActions}>
            <Link href={block.href} className={`${styles.leadCardAction} ${styles.leadCardPrimary}`}>Abrir conversa</Link>
            {block.whatsappHref ? (
              <a href={block.whatsappHref} target={external(block.whatsappHref) ? "_blank" : undefined} rel="noopener noreferrer" className={`${styles.leadCardAction} ${styles.leadCardWhatsapp}`}>WhatsApp</a>
            ) : null}
            <Link href={block.fichaHref} className={styles.leadCardAction}>Ficha completa</Link>
          </div>
          <Updated at={block.updatedAt} />
        </section>
      );
    }
  }
}
