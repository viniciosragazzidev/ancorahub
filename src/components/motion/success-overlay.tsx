"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SuccessMoment } from "@/components/motion/success-moment";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

const VISIBLE_MS = 1400;

/**
 * Momento de destaque sem alterar o layout da tela: mostra o check em círculo centralizado,
 * sem capturar cliques (pointer-events-none), e some sozinho.
 * Uso: `const { celebrate, node } = useSuccessOverlay(); ... celebrate("Lead aceito"); return <>{...}{node}</>`.
 */
export function useSuccessOverlay(): { celebrate: (title?: string) => void; node: ReactNode } {
  const enabled = useInterfaceMotionEnabled();
  const [state, setState] = useState<{ id: number; title?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const celebrate = useCallback((title?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ id: Date.now(), title });
    timer.current = setTimeout(() => setState(null), VISIBLE_MS);
  }, []);

  const node = (
    <AnimatePresence>
      {state ? (
        <motion.div
          key={state.id}
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: enabled ? 0.2 : 0 }}
        >
          <div className="rounded-[var(--radius-panel)] border border-border bg-card px-10 py-8 shadow-[var(--shadow-dialog)]">
            <SuccessMoment title={state.title} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return { celebrate, node };
}
