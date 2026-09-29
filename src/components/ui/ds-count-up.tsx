"use client";

import * as React from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Animated number for KPI tiles. When the value changes (a live refresh, a new
 * filter) it eases from the previous number to the new one in ~400ms, so the
 * eye sees WHAT changed instead of a value silently swapping. The first paint
 * is never animated (no count from zero on load), and reduced motion shows the
 * final value immediately.
 */
export function DsCountUp({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const previous = React.useRef(value);
  const [shown, setShown] = React.useState(value);

  React.useEffect(() => {
    if (reduce || previous.current === value) {
      previous.current = value;
      setShown(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setShown(Math.round(latest)),
      onComplete: () => setShown(value),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden="true" className="tabular-nums">{shown}</span>
    </span>
  );
}
