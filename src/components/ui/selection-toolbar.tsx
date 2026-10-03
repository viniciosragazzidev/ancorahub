"use client";

import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { transitions } from "@/lib/motion";
import { motion, AnimatePresence } from "motion/react";
import { X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function SelectionToolbar({
  selectedCount,
  totalCount,
  onClear,
  children,
}: {
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const motionEnabled = useInterfaceMotionEnabled();
  return (
    <AnimatePresence initial={false}>
      {selectedCount > 0 && (
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: -4 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: motionEnabled ? -4 : 0 }}
          transition={motionEnabled ? transitions.fast : { duration: 0 }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5 shadow-xs sm:gap-4 sm:px-4"
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium tabular-nums">
              {selectedCount} de {totalCount} selecionado
              {selectedCount === 1 ? "" : "s"}
            </span>
            <Button
              onClick={onClear}
              size="xs"
              variant="ghost"
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              Limpar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
