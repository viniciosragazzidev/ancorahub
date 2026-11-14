"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, PauseCircle } from "lucide-react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { LiteSuccess } from "@/components/lite/motion/success";
import { cn } from "@/lib/utils";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { toast } from "@/components/ui/sonner";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

export type LightAvailability = "available" | "paused" | "offline";
export type LightAvailabilityOptions = {
  /** A tela mostra o erro no próprio lugar (ex.: o aviso de pausa do Início); sem toast repetindo. */
  inlineError?: boolean;
};

/**
 * Availability state shared by the header pill and the "Mais" sheet.
 * Feedback nível 1 (docs/design-system/FEEDBACK.md): toque vibra curto; o novo estado só depois que o servidor
 * confirma, com vibração e o som discreto de confirmação (ação ocasional); a falha diz a causa e que a
 * disponibilidade não mudou, e o mesmo controle tenta de novo.
 */
export function useLightAvailability(initial: LightAvailability = "available") {
  const fire = useFeedback();
  const [availability, setAvailability] = useState<LightAvailability>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setStatus(next: "available" | "paused", options: LightAvailabilityOptions = {}) {
    if (next === availability || isPending) return;
    setError(null);
    fire("tap");
    startTransition(async () => {
      try {
        await updateBrokerAvailabilityAction(next);
        setAvailability(next);
        fire("confirm", { sound: true });
      } catch (cause) {
        const keeps = availability === "paused" ? "Você continua pausado" : "Você continua recebendo leads";
        const message = actionErrorMessage(normalizeActionError(cause, "Não consegui mudar sua disponibilidade"), keeps);
        setError(message);
        fire("error");
        if (!options.inlineError) toast.error(message);
      }
    });
  }

  return { availability, isPending, error, setStatus };
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
  const confirmed = useConfirmedChange(availability, isPending);
  const label = available ? "Disponível" : "Pausado";
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
      {confirmed ? (
        // Confirmado pelo servidor: o check se desenha no lugar do ícone, com o mesmo rótulo (largura igual).
        <LiteSuccess label={label} className="gap-1.5" />
      ) : (
        <>
          {available ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

/** true por um instante depois que a troca pedida foi confirmada (enviando → estado novo). */
function useConfirmedChange(availability: LightAvailability, isPending: boolean) {
  const [confirmed, setConfirmed] = useState(false);
  const before = useRef<LightAvailability | null>(null);
  useEffect(() => {
    if (isPending) {
      if (before.current === null) before.current = availability;
      return;
    }
    if (before.current === null) return;
    const changed = before.current !== availability;
    before.current = null;
    if (!changed) return;
    // Confirmação momentânea depois do servidor; os timers só ligam e desligam o check (fora do render).
    const show = window.setTimeout(() => setConfirmed(true), 0);
    const hide = window.setTimeout(() => setConfirmed(false), motionTokens.celebration.revertAfter * 1000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
      setConfirmed(false);
    };
  }, [availability, isPending]);
  return confirmed;
}
