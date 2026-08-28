"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

import { playSound } from "@/lib/sounds/player";
import { notificationSound } from "@/lib/sounds/recipes";

import { ArrowRight, BellRinging } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import type { IncomingLead } from "./incoming-lead-queue";

let lastSoundPlayedAt = 0;
const SOUND_THROTTLE_MS = 4000;

export function IncomingLeadCard({
  item,
  queuedCount = 0,
  onResolve,
}: {
  item: IncomingLead | null;
  queuedCount?: number;
  onResolve: (item: IncomingLead, reason: "open" | "dismiss") => void;
}) {
  const activeToastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!item) {
      if (activeToastIdRef.current) {
        toast.dismiss(activeToastIdRef.current);
        activeToastIdRef.current = null;
      }
      return;
    }

    const now = Date.now();
    if (now - lastSoundPlayedAt >= SOUND_THROTTLE_MS) {
      lastSoundPlayedAt = now;
      try {
        playSound(notificationSound, { volume: 0.8 });
      } catch {
        // Fallback se o navegador exigir gesto do usuário
      }
    }

    const toastId = `incoming-lead-${item.notificationId}`;
    activeToastIdRef.current = toastId;

    toast.custom(
      (t) => (
        <div
          data-testid="incoming-lead-card"
          className="group relative flex w-full max-w-sm flex-col gap-3 rounded-xl border border-primary/30 bg-card/95 p-3.5 shadow-lg backdrop-blur-md select-none dark:bg-card/90"
        >
          <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/[0.04] pb-2.5 -mx-3.5 -mt-3.5 px-3.5 pt-3.5 rounded-t-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <BellRinging className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Novo lead recebido</p>
              <p className="truncate text-[11px] text-muted-foreground">Uma nova oportunidade entrou na sua fila</p>
            </div>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t);
                onResolve(item, "dismiss");
              }}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 cursor-pointer"
              aria-label="Dispensar novo lead"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold leading-relaxed text-foreground">{item.title}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{item.message}</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            {queuedCount > 0 ? (
              <span className="text-[11px] text-muted-foreground">+{queuedCount} aguardando</span>
            ) : (
              <span />
            )}
            <Button
              render={
                <Link
                  href={`/leads/${encodeURIComponent(item.leadId)}`}
                  onClick={() => {
                    toast.dismiss(t);
                    onResolve(item, "open");
                  }}
                />
              }
              variant="default"
              size="sm"
              className="gap-1.5 h-8 text-xs shadow-sm"
            >
              Atender agora
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      ),
      { id: toastId, duration: 10000, position: "bottom-right" },
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [item, queuedCount, onResolve]);

  return null;
}
