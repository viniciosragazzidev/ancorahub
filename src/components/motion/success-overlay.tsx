"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SuccessMoment } from "@/components/motion/success-moment";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { useArcScopeProps } from "@/components/arc/arc-scope-context";
import { cn } from "@/lib/utils";
import { Mascot } from "@/components/mascot/mascot";
import type { MascotState } from "@/components/mascot/mascot-config";
import { useMascotPlacement } from "@/components/mascot/mascot-slot";

const VISIBLE_MS = 1400;

/**
 * Momento de destaque sem alterar o layout da tela: mostra o check em círculo centralizado,
 * sem capturar cliques (pointer-events-none), e some sozinho.
 * Uso: `const { celebrate, node } = useSuccessOverlay(); ... celebrate("Lead aceito"); return <>{...}{node}</>`.
 */
export function useSuccessOverlay(): { celebrate: (title?: string, options?: { mascot?: MascotState }) => void; node: ReactNode } {
  const enabled = useInterfaceMotionEnabled();
  const arcScope = useArcScopeProps();
  const [state, setState] = useState<{ id: number; title?: string; mascot?: MascotState } | null>(null);
  // Vaga do mascote (mascot-placements.ts, "success"): ligada, o mascote entra no lugar do check.
  const mascotSlot = useMascotPlacement("success");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const celebrate = useCallback((title?: string, options?: { mascot?: MascotState }) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ id: Date.now(), title, mascot: options?.mascot });
    timer.current = setTimeout(() => setState(null), VISIBLE_MS);
  }, []);

  const node = (
    <AnimatePresence>
      {state ? (
        <motion.div
          key={state.id}
          data-skin={arcScope["data-skin"]}
          aria-live="polite"
          className={cn("pointer-events-none fixed inset-0 z-[60] grid place-items-center", arcScope.className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: enabled ? 0.2 : 0 }}
        >
          <div className="rounded-[var(--radius-panel)] border border-border bg-card px-10 py-8 shadow-[var(--shadow-dialog)]">
            {mascotSlot ? (
              <div role="status" className="flex flex-col items-center gap-3 text-center">
                <Mascot state={state.mascot ?? mascotSlot.state} size={mascotSlot.size} decorative />
                {state.title ? <p className="text-base font-semibold text-foreground">{state.title}</p> : null}
              </div>
            ) : (
              <SuccessMoment title={state.title} />
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return { celebrate, node };
}
