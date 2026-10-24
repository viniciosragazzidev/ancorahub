"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

export interface LiteCollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

const curve = `cubic-bezier(${motionTokens.ease.standard.join(",")})`;

/**
 * Abre e fecha altura com grid-template-rows (0fr para 1fr), sem animar height.
 * Fechado fica inerte (fora do foco e da leitura). Com movimento reduzido, só opacidade.
 */
export function LiteCollapse({ open, children, className }: LiteCollapseProps) {
  const reduce = useReducedMotion();
  const transition = reduce
    ? `opacity ${motionTokens.duration.instant}s linear`
    : `grid-template-rows ${motionTokens.duration.standard}s ${curve}, opacity ${motionTokens.duration.fast}s ${curve}`;
  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition }}
      aria-hidden={!open}
      inert={!open}
    >
      <div style={{ minHeight: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
