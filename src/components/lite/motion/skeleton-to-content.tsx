"use client";

import type { ReactNode } from "react";

import { LiteSwap } from "./swap";

export interface LiteSkeletonToContentProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  /** Altura reservada para o skeleton, para o conteúdo não pular quando chegar. */
  minHeight?: number | string;
  className?: string;
}

/** O skeleton dá lugar ao conteúdo com LiteSwap, sobre uma altura mínima reservada (sem salto). */
export function LiteSkeletonToContent({ loading, skeleton, children, minHeight, className }: LiteSkeletonToContentProps) {
  return (
    <div className={className} style={{ minHeight }}>
      <LiteSwap swapKey={loading ? "loading" : "content"}>{loading ? skeleton : children}</LiteSwap>
    </div>
  );
}
