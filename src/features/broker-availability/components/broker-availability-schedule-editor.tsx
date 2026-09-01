"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarCheck, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveOwnBrokerAvailabilityAction } from "../actions";
import { WEEKDAY_LABELS, type BrokerAvailabilityWindowInput } from "../contracts";

type Props = {
  initialWindows: BrokerAvailabilityWindowInput[];
  onSaved?: (windows: BrokerAvailabilityWindowInput[]) => void;
  submitLabel?: string;
  compact?: boolean;
};

const DEFAULT_WINDOW: BrokerAvailabilityWindowInput = { dayOfWeek: 1, startsAt: "08:00", endsAt: "18:00" };

function ordered(windows: BrokerAvailabilityWindowInput[]) {
  return [...windows].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startsAt.localeCompare(b.startsAt));
}

export function BrokerAvailabilityScheduleEditor({ initialWindows, onSaved, submitLabel = "Salvar disponibilidade", compact = false }: Props) {
  const [windows, setWindows] = useState<BrokerAvailabilityWindowInput[]>(ordered(initialWindows));
  const [pending, startTransition] = useTransition();
  const grouped = useMemo(() => WEEKDAY_LABELS.map((label, dayOfWeek) => ({ label, dayOfWeek, windows: windows.filter((window) => window.dayOfWeek === dayOfWeek) })), [windows]);

  function addWindow(dayOfWeek: number) {
    setWindows((current) => ordered([...current, { ...DEFAULT_WINDOW, dayOfWeek }]));
  }

  function updateWindow(index: number, patch: Partial<BrokerAvailabilityWindowInput>) {
    setWindows((current) => ordered(current.map((window, currentIndex) => currentIndex === index ? { ...window, ...patch } : window)));
  }

  function removeWindow(index: number) {
    setWindows((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function save() {
    if (!windows.length) {
      toast.error("Escolha ao menos um período em que você pode receber novos leads.");
      return;
    }
    const snapshot = windows;
    startTransition(async () => {
      try {
        const result = await saveOwnBrokerAvailabilityAction({ windows: snapshot });
        const saved = ordered(result.windows);
        setWindows(saved);
        onSaved?.(saved);
        toast.success("Sua agenda de distribuição foi atualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar sua disponibilidade.");
      }
    });
  }

  return (
    <section className={cn("space-y-4", compact && "space-y-3")} aria-labelledby="broker-availability-title">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarCheck className="size-4" aria-hidden="true" /></span>
        <div>
          <h2 className="text-base font-semibold" id="broker-availability-title">Quando você pode receber novos leads?</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">A distribuição automática só considera você nos períodos abaixo. A pausa manual continua valendo a qualquer momento.</p>
        </div>
      </div>

      <div className="grid gap-2" role="list" aria-label="Agenda semanal de disponibilidade">
        {grouped.map(({ label, dayOfWeek, windows: dayWindows }) => (
          <div className="rounded-lg border border-border/70 bg-card p-3" key={dayOfWeek} role="listitem">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{label}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => addWindow(dayOfWeek)} disabled={pending}>
                <Plus aria-hidden="true" className="size-4" /> Adicionar horário
              </Button>
            </div>
            {dayWindows.length ? (
              <div className="mt-2 grid gap-2">
                {dayWindows.map((window) => {
                  const index = windows.indexOf(window);
                  return (
                    <div className="flex items-center gap-2" key={`${window.dayOfWeek}-${window.startsAt}-${window.endsAt}-${index}`}>
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <Input aria-label={`Início de ${label}`} type="time" value={window.startsAt} disabled={pending} onChange={(event) => updateWindow(index, { startsAt: event.target.value })} className="h-9 w-28" />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input aria-label={`Fim de ${label}`} type="time" value={window.endsAt} disabled={pending} onChange={(event) => updateWindow(index, { endsAt: event.target.value })} className="h-9 w-28" />
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover horário de ${label}`} onClick={() => removeWindow(index)} disabled={pending}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-2 text-xs text-muted-foreground">Indisponível para distribuição automática.</p>}
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 bg-card/95 backdrop-blur border-t border-border p-4 flex flex-wrap items-center justify-between gap-3 shadow-md rounded-b-lg">
        <p className="text-xs text-muted-foreground">Horários em America/São Paulo.</p>
        <Button type="button" onClick={save} disabled={pending}>{pending ? "Salvando…" : submitLabel}</Button>
      </div>
    </section>
  );
}
