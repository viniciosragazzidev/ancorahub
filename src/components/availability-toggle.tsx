"use client";

import { useState, useTransition } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";

export function AvailabilityToggle({
  initialStatus,
}: {
  initialStatus: "available" | "paused" | "offline";
}) {
  const [status, setStatus] = useState<"available" | "paused" | "offline">(initialStatus ?? "available");
  const [isPending, startTransition] = useTransition();

  const handleToggle = (newStatus: "available" | "paused" | "offline") => {
    if (newStatus === status || isPending) return;
    const oldStatus = status;
    setStatus(newStatus);
    startTransition(async () => {
      try {
        await updateBrokerAvailabilityAction(newStatus);
        toast.success(`Disponibilidade alterada para ${newStatus === "available" ? "Disponível" : newStatus === "paused" ? "Pausado" : "Offline"}`);
      } catch (err) {
        setStatus(oldStatus);
        toast.error("Erro ao alterar disponibilidade.");
      }
    });
  };

  return (
    <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleToggle("available")}
        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
          status === "available"
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Disponível
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleToggle("paused")}
        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
          status === "paused"
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Pausa
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => handleToggle("offline")}
        className={`px-2 py-0.5 rounded-md font-medium transition-all ${
          status === "offline"
            ? "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Offline
      </button>
    </div>
  );
}
