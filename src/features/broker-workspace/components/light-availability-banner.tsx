"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";

type Status = "available" | "paused" | "offline";

export function LightAvailabilityBanner({
  initialStatus,
}: {
  initialStatus: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  if (status === "available" || dismissed) return null;

  function handleResume() {
    startTransition(async () => {
      try {
        await updateBrokerAvailabilityAction("available");
        setStatus("available");
        toast.success("Você está disponível para receber novos leads.");
      } catch {
        toast.error("Não foi possível atualizar a disponibilidade.");
      }
    });
  }

  const label =
    status === "paused"
      ? "Você está pausado · Não receberá novos leads"
      : "Você está offline · Não receberá leads ou notificações";

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2.5"
    >
      <p className="text-xs font-medium text-foreground">
        <span className="mr-1.5">⏸</span>
        {label}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={handleResume}
        className="shrink-0 rounded-lg border border-warning/40 bg-warning/20 px-3 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-warning/30 disabled:opacity-50"
      >
        {pending ? "Retomando..." : "Retomar"}
      </button>
    </div>
  );
}
