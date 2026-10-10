"use client";

import { motion, useReducedMotionConfig } from "motion/react";

import { Avatar } from "@/components/arc/avatar/avatar";

import styles from "./journey.module.css";

export type PodiumEntry = { id: string; name: string; imageUrl: string | null; position: number; value: string; highlight?: boolean; highlightLabel?: string };

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];
export const MEDAL = ["oklch(80% .14 85)", "oklch(82% .01 250)", "oklch(70% .1 55)"];
const HEIGHTS = [72, 96, 56];
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Top 3 on steps (2nd, 1st, 3rd): the steps rise first, then the avatars land.
 * Used by the broker's unit board, the team's internal board and the board
 * between teams (`fullName` keeps a team name whole).
 */
export function Podium({ entries, label, fullName = false }: { entries: PodiumEntry[]; label: string; fullName?: boolean }) {
  const reduce = useReducedMotionConfig();
  const top = [...entries].sort((a, b) => a.position - b.position).slice(0, 3);
  const slots = [top[1], top[0], top[2]];
  return (
    <ol className={styles.podium} aria-label={label}>
      {slots.map((entry, slot) => {
        if (!entry) return <li key={`empty-${slot}`} className={styles.podiumEmpty} aria-hidden="true" />;
        const color = MEDAL[Math.min(2, Math.max(0, entry.position - 1))];
        const delay = reduce ? 0 : [0.15, 0, 0.3][slot]!;
        return (
          <li key={entry.id} className={styles.place} data-self={Boolean(entry.highlight)}>
            <motion.span className={styles.placeAvatar} style={{ "--medal": color } as React.CSSProperties} initial={reduce ? false : { opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: EASE, delay: delay + 0.35 }}>
              <Avatar name={entry.name} src={entry.imageUrl ?? undefined} size="lg" />
              <span className={styles.placeMedal} aria-hidden="true">{entry.position}</span>
            </motion.span>
            <span className={styles.placeName} data-full={fullName}>{entry.highlight && entry.highlightLabel ? entry.highlightLabel : fullName ? entry.name : firstName(entry.name)}</span>
            <span className={styles.placePoints}>{entry.value}</span>
            <motion.span className={styles.placeStep} style={{ "--medal": color } as React.CSSProperties} initial={reduce ? false : { height: 0 }} animate={{ height: HEIGHTS[slot] }} transition={{ duration: 0.6, ease: EASE, delay }} aria-hidden="true" />
            <span className="sr-only">{entry.position}º lugar, {entry.name}, {entry.value}</span>
          </li>
        );
      })}
    </ol>
  );
}
