"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { ArrowRight, BellRinging, X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IncomingLead } from "./incoming-lead-queue";

export function IncomingLeadCard({
  item,
  queuedCount = 0,
  onResolve,
}: {
  item: IncomingLead | null;
  queuedCount?: number;
  onResolve: (item: IncomingLead, reason: "open" | "dismiss") => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {item ? (
        <motion.div
          key={item.notificationId}
          data-testid="incoming-lead-card"
          role="alert"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 28, mass: 0.7 }}
          className="fixed inset-x-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[65] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[min(380px,calc(100vw-2rem))]"
        >
          <Card className="overflow-hidden border-primary/25 bg-card/95 p-0 shadow-[0_18px_50px_-24px_hsl(var(--primary)/0.45)] backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/[0.04] px-4 py-3">
              <motion.span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary"
                animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
                transition={reduceMotion ? undefined : { duration: 1.2, repeat: 1, ease: "easeOut" }}
              >
                <BellRinging className="size-4" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Novo lead recebido</p>
                <p className="truncate text-xs text-muted-foreground">Uma nova oportunidade entrou na sua fila</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Dispensar novo lead"
                onClick={() => onResolve(item, "dismiss")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-base font-semibold leading-tight text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.message}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                {queuedCount > 0 ? (
                  <span className="text-xs text-muted-foreground">+{queuedCount} aguardando</span>
                ) : <span />}
                <Button
                  render={<Link href={`/leads/${encodeURIComponent(item.leadId)}`} onClick={() => onResolve(item, "open")} />}
                  variant="default"
                  size="sm"
                  className={cn("gap-1.5 shadow-sm")}
                >
                  Atender agora
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
