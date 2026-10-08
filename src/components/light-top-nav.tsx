"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { toast } from "@/components/ui/sonner";

export type LightAvailability = "available" | "paused" | "offline";

/** Availability state shared by the header pill and the "Mais" sheet. */
export function useLightAvailability(initial: LightAvailability = "available") {
  const [availability, setAvailability] = useState<LightAvailability>(initial);
  const [isPending, startTransition] = useTransition();

  function setStatus(next: "available" | "paused") {
    if (next === availability || isPending) return;
    startTransition(async () => {
      try {
        await updateBrokerAvailabilityAction(next);
        setAvailability(next);
      } catch {
        toast.error("Não foi possível alterar a disponibilidade.");
      }
    });
  }

  return { availability, isPending, setStatus };
}

export function getUserInitials(name: string | null | undefined) {
  return (name || "Corretor")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CO";
}

/** Compact status pill for the root header: one tap toggles available/paused. */
export function LightAvailabilityPill({
  availability,
  isPending,
  onToggle,
  className,
}: {
  availability: LightAvailability;
  isPending: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const available = availability === "available";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      aria-pressed={available}
      aria-label={available ? "Disponível para receber leads. Tocar para pausar" : "Pausado. Tocar para ficar disponível"}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full bg-(--surface) px-3.5 text-xs font-semibold shadow-(--shadow-resting) transition-transform active:scale-95 disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
        available ? "text-(--success)" : "text-(--warning)",
        className,
      )}
    >
      {available ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
      <span>{available ? "Disponível" : "Pausado"}</span>
    </button>
  );
}
