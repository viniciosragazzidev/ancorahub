"use client";

import { useEffect, useRef } from "react";

import { fireFeedback } from "@/lib/feedback/use-feedback";

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
      fireFeedback("notify");
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
