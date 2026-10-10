"use client";

import { motion, useReducedMotionConfig } from "motion/react";

import styles from "./journey.module.css";

/** Hue of each level (index 0..4), used by the ring and the hero. */
export const LEVEL_HUE = [212, 150, 268, 28, 48] as const;

/** Progress to the next level as a ring that fills on mount, the level number in the middle. */
export function LevelRing({ index, percentage, size = 96 }: { index: number; percentage: number; size?: number }) {
  const reduce = useReducedMotionConfig();
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const hue = LEVEL_HUE[Math.min(LEVEL_HUE.length - 1, Math.max(0, index))];
  const value = Math.min(100, Math.max(0, percentage));
  return (
    <span className={styles.levelRing} style={{ width: size, height: size, "--level-hue": hue } as React.CSSProperties} role="img" aria-label={`Nível ${index + 1}, ${value}% para o próximo`}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={radius} className={styles.levelTrack} />
        <motion.circle
          cx="50" cy="50" r={radius}
          className={styles.levelValue}
          strokeDasharray={length}
          initial={{ strokeDashoffset: reduce ? length * (1 - value / 100) : length }}
          animate={{ strokeDashoffset: length * (1 - value / 100) }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className={styles.levelCore} aria-hidden="true">
        <small>Nível</small>
        <strong>{index + 1}</strong>
      </span>
    </span>
  );
}
