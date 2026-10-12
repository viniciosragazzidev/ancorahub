"use client";

import { motion, useReducedMotion } from "motion/react";

import { AssistantAvatar } from "./assistant-avatar";
import styles from "./chat.module.css";
import type { ChatBlock } from "./types";

type PausedBlock = Extract<ChatBlock, { type: "paused" }>;

const ZZZ = [
  { x: 18, size: 13, delay: 0 },
  { x: 30, size: 16, delay: 0.9 },
  { x: 44, size: 20, delay: 1.8 },
];

/**
 * An assistant switched off for now: a soft aurora in the mascot's color, the
 * mascot floating asleep with "z"s rising, a pulsing "Em pausa" pill and the reason.
 */
export function PausedHero({ block }: { block: PausedBlock }) {
  const reduce = useReducedMotion();
  return (
    <section className={styles.paused} style={{ "--paused-hue": block.hue } as React.CSSProperties} aria-label={block.title}>
      <span className={styles.pausedAurora} aria-hidden="true" />
      <div className={styles.pausedStage} aria-hidden="true">
        <motion.span
          className={styles.pausedMascot}
          animate={reduce ? undefined : { y: [0, -6, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <AssistantAvatar shape={block.shape} hue={block.hue} size={76} />
        </motion.span>
        {reduce ? null : ZZZ.map((z) => (
          <motion.span
            key={z.x}
            className={styles.pausedZ}
            style={{ left: `calc(50% + ${z.x}px)`, fontSize: z.size }}
            initial={{ opacity: 0, y: 0, x: 0 }}
            animate={{ opacity: [0, 1, 0], y: -42, x: 10 }}
            transition={{ duration: 2.7, delay: z.delay, repeat: Infinity, ease: "easeOut" }}
          >
            z
          </motion.span>
        ))}
      </div>
      <span className={styles.pausedPill}><span className={styles.pausedDot} />Em pausa</span>
      <h2 className={styles.pausedTitle}>{block.title}</h2>
      <p className={styles.pausedText}>{block.text}</p>
    </section>
  );
}
