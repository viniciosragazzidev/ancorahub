"use client";

import { motion } from "motion/react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { cn } from "@/lib/utils";

type SuccessMomentProps = {
  title?: string;
  description?: string;
  /** "md" = 64px, "sm" = 40px (inline, ex.: dentro de toast ou linha). */
  size?: "sm" | "md";
  className?: string;
};

const EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Momento de destaque do CRM (MOTION.md): check verde em círculo, escala 0.9→1 + fade em 350ms,
 * traço do check desenhado em seguida. Sem bounce. Reduced motion: aparece direto.
 */
export function SuccessMoment({ title, description, size = "md", className }: SuccessMomentProps) {
  const enabled = useInterfaceMotionEnabled();
  const box = size === "md" ? "size-16" : "size-10";
  const icon = size === "md" ? "size-8" : "size-5";

  return (
    <div role="status" className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <motion.span
        initial={enabled ? { opacity: 0, scale: 0.9 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: EXPO }}
        className={cn("grid place-items-center rounded-full border border-success/30 bg-success/10 text-success", box)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={icon} aria-hidden="true">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={enabled ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.12, ease: EXPO }}
          />
        </svg>
      </motion.span>
      {(title || description) && (
        <motion.div
          initial={enabled ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: EXPO }}
          className="space-y-1"
        >
          {title && <p className="text-base font-semibold text-foreground">{title}</p>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </motion.div>
      )}
    </div>
  );
}
