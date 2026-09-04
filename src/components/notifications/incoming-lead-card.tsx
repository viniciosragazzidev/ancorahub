"use client";

import { useEffect, useRef } from "react";

import { playSound } from "@/lib/sounds/player";
import { notificationSound } from "@/lib/sounds/recipes";

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

    toast.success(item.title, {
      description: queuedCount > 0
        ? `${item.message} (+${queuedCount} aguardando)`
        : item.message,
      badgeLabel: "Novo lead recebido",
      duration: 10000,
      id: toastId,
      action: {
        label: "Atender agora",
        onClick: () => {
          onResolve(item, "open");
        },
      },
      cancel: {
        label: "Dispensar",
        onClick: () => {
          onResolve(item, "dismiss");
        },
      },
    });

    return () => {
      toast.dismiss(toastId);
    };
  }, [item, queuedCount, onResolve]);

  return null;
}
