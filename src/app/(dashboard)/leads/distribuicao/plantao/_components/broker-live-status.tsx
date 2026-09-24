"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import type { BrokerLiveOfferStatus } from "@/features/lead-distribution/duty-roster-live-status";

const STATUS_UI: Record<BrokerLiveOfferStatus, { label: string; status: AnimatedBadgeStatus; pulse: boolean }> = {
  paused: { label: "Pausado", status: "neutral", pulse: false },
  ready: { label: "Pronto para receber", status: "success", pulse: true },
  offer_pending: { label: "Oferta enviada", status: "info", pulse: true },
  cooldown: { label: "Próximo lead em", status: "warning", pulse: false },
  capacity_full: { label: "Limite da fila atingido", status: "neutral", pulse: false },
  blocked: { label: "Indisponível", status: "danger", pulse: false },
};

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Live "can this broker receive the next automatic lead" indicator: a status
 * pill plus, for offer_pending/cooldown, a self-ticking mm:ss countdown to
 * the next state change. Ticks entirely client-side from the one timestamp
 * the server computed (`nextEventAt`) — no polling, no server round-trip.
 */
export function BrokerLiveStatus({ status, nextEventAt }: { status: BrokerLiveOfferStatus; nextEventAt: string | null }) {
  const ui = STATUS_UI[status];
  const target = nextEventAt ? new Date(nextEventAt).getTime() : null;
  // Starts unset (SSR-safe — the server's Date.now() would not match the
  // client's) and is filled in by the interval's own first tick, one second
  // after mount, rather than a synchronous setState in the effect body.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setRemainingMs(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const countingDown = target !== null && remainingMs !== null && remainingMs > 0;
  const seconds = countingDown ? Math.round((remainingMs ?? 0) / 1000) : null;

  return (
    <AnimatedBadge status={ui.status} size="sm" pulse={ui.pulse} showIcon={false} contentKey={`${status}:${seconds ?? ""}`}>
      {ui.label}
      {countingDown ? <span className="font-mono tabular-nums">{formatCountdown(remainingMs ?? 0)}</span> : null}
    </AnimatedBadge>
  );
}

/** Compact capacity bar: leads actively assigned vs. the queue's per-broker limit. */
export function BrokerCapacityBar({ activeLeads, capacity }: { activeLeads: number; capacity: number | null }) {
  if (capacity === null) return null;
  const ratio = capacity > 0 ? Math.min(1, activeLeads / capacity) : 0;
  const atLimit = activeLeads >= capacity;
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-2 w-full max-w-24 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={`h-full rounded-full ${atLimit ? "bg-muted-foreground/50" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{activeLeads}/{capacity}</span>
    </div>
  );
}
