"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/utils/core/cn";

export interface DsSelectionBarProps extends Omit<React.ComponentPropsWithoutRef<"div">, "children" | "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> {
  /** Number of selected items; the bar is only mounted when this is above 0. */
  count: number;
  /** Actions for the selection. ONE primary + secondary; destructive ones belong in a menu. */
  children: React.ReactNode;
}

/**
 * Selection bar — appears above a list when rows are selected, and folds away
 * when the selection is cleared. It slides/fades in (≤ 200ms) so the user sees
 * where the bulk actions came from, instead of the list jumping down.
 *
 * Info callout tone (Powder Blue wash, Electric Blue border) because a
 * selection is context, not a status.
 */
export function DsSelectionBar({ count, children, className, ...props }: DsSelectionBarProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {count > 0 ? (
        <motion.div
          key="selection-bar"
          role="status"
          aria-live="polite"
          initial={reduce ? false : { opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
          {...props}
        >
          <div className={cn("flex flex-wrap items-center justify-between gap-ds-12 rounded-ds-cards border border-ds-electric-blue bg-ds-powder-blue px-ds-16 py-ds-8 font-ds-inter text-ds-body text-ds-charcoal", className)}>
            <span>
              <strong className="font-semibold tabular-nums">{count}</strong> {count === 1 ? "selecionado" : "selecionados"}
            </span>
            <div className="flex flex-wrap items-center gap-ds-8">{children}</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
