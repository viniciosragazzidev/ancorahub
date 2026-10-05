"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

type CopyCheckIconProps = {
  copied: boolean;
  /** Ícone de copiar padrão do botão. */
  children: ReactNode;
  className?: string;
};

/** Troca o ícone de copiar por um check (fade + scale 0.8→1, 150ms). O pai controla o `copied` por ~1,5s. */
export function CopyCheckIcon({ copied, children, className }: CopyCheckIconProps) {
  const enabled = useInterfaceMotionEnabled();
  const transition = { duration: enabled ? 0.15 : 0, ease: [0.25, 1, 0.5, 1] as const };
  return (
    <span className={className ?? "relative inline-flex size-4 items-center justify-center"}>
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-full text-success"
            aria-hidden="true"
            initial={enabled ? { opacity: 0, scale: 0.8 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={transition}
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </motion.svg>
        ) : (
          <motion.span
            key="icon"
            className="inline-flex size-full items-center justify-center [&>svg]:size-full"
            initial={enabled ? { opacity: 0, scale: 0.8 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={transition}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
