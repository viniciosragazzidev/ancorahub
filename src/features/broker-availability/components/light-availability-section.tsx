"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Switch } from "@/components/arc/switch/switch";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";
import { toast } from "@/components/ui/sonner";

import { saveOwnBrokerAvailabilityAction } from "../actions";
import { DEFAULT_AVAILABILITY_HOURS, DEFAULT_BROKER_AVAILABILITY, WEEKDAY_LABELS, type BrokerAvailabilityWindowInput } from "../contracts";

const DEFAULT_WINDOW: BrokerAvailabilityWindowInput = { dayOfWeek: 1, ...DEFAULT_AVAILABILITY_HOURS };

function ordered(windows: BrokerAvailabilityWindowInput[]) {
  return [...windows].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startsAt.localeCompare(b.startsAt));
}

const card = "rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)";

/**
 * Disponibilidade of the broker app: the manual pause (same state as the header) and the weekly
 * windows in which automatic distribution may include the broker. Saves through the same action
 * as the desktop editor.
 */
export function LightAvailabilitySection({ windows: initialWindows, schemaReady = true }: { windows: BrokerAvailabilityWindowInput[]; schemaReady?: boolean }) {
  const availability = useLightAvailabilityContext();
  const [windows, setWindows] = useState<BrokerAvailabilityWindowInput[]>(ordered(initialWindows.length ? initialWindows : DEFAULT_BROKER_AVAILABILITY));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const grouped = useMemo(
    () => WEEKDAY_LABELS.map((label, dayOfWeek) => ({ label, dayOfWeek, windows: windows.filter((window) => window.dayOfWeek === dayOfWeek) })),
    [windows],
  );

  function change(next: BrokerAvailabilityWindowInput[]) {
    setSaved(false);
    setWindows(ordered(next));
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
        setWindows(ordered(result.windows));
        setSaved(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar sua disponibilidade.");
      }
    });
  }

  if (!schemaReady) {
    return (
      <p className={`arc-venancor ${card} text-sm text-(--text-secondary)`}>
        A configuração de disponibilidade está sendo preparada. Suas demais áreas continuam disponíveis; tente novamente em alguns minutos.
      </p>
    );
  }

  return (
    <div className="arc-venancor flex flex-col gap-4">
      {availability ? (
        <section aria-labelledby="pause-heading" className={`${card} flex items-start justify-between gap-4`}>
          <div className="min-w-0">
            <h2 id="pause-heading" className="text-base font-semibold text-(--foreground)">Receber novos leads agora</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">
              {availability.availability === "available"
                ? "Você está disponível. Desligue para pausar a qualquer momento."
                : "Você está pausado e não recebe novos leads até ligar de novo."}
            </p>
          </div>
          <Switch
            aria-label="Receber novos leads agora"
            checked={availability.availability === "available"}
            disabled={availability.isPending}
            onCheckedChange={(checked) => availability.setStatus(checked ? "available" : "paused")}
          />
        </section>
      ) : null}

      <section aria-labelledby="schedule-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="schedule-heading" className="text-base font-semibold text-(--foreground)">Quando você pode receber novos leads?</h2>
          <p className="mt-1 text-sm text-(--text-secondary)">
            A distribuição automática só considera você nos períodos abaixo. Fora deles, você continua vendo sua carteira atual. Horários de São Paulo.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {grouped.map(({ label, dayOfWeek, windows: dayWindows }) => (
            <li key={dayOfWeek} className={`${card} flex flex-col gap-4`}>
              <p className="text-sm font-semibold text-(--foreground)">{label}</p>
              {dayWindows.length ? (
                <ul className="flex flex-col gap-4">
                  {dayWindows.map((window) => {
                    const index = windows.indexOf(window);
                    return (
                      <li key={`${window.dayOfWeek}-${index}`} className="flex flex-wrap items-end gap-3">
                        <div className="min-w-32 flex-1">
                          <Input
                            label={`Início, ${label}`}
                            type="time"
                            value={window.startsAt}
                            disabled={pending}
                            onChange={(event) => change(windows.map((item, current) => (current === index ? { ...item, startsAt: event.target.value } : item)))}
                          />
                        </div>
                        <div className="min-w-32 flex-1">
                          <Input
                            label={`Fim, ${label}`}
                            type="time"
                            value={window.endsAt}
                            disabled={pending}
                            onChange={(event) => change(windows.map((item, current) => (current === index ? { ...item, endsAt: event.target.value } : item)))}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          disabled={pending}
                          aria-label={`Remover horário de ${label}`}
                          onClick={() => change(windows.filter((_, current) => current !== index))}
                        >
                          Remover
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-(--text-secondary)">Indisponível para distribuição automática.</p>
              )}
              <Button variant="secondary" disabled={pending} onClick={() => change([...windows, { ...DEFAULT_WINDOW, dayOfWeek }])}>
                Adicionar horário
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <nav
        aria-label="Salvar disponibilidade"
        className="fixed inset-x-4 bottom-[calc(22px+var(--mobile-safe-bottom))] z-40 md:left-[calc(72px+1rem)]"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full bg-(--surface)/86 p-2 pl-5 shadow-(--shadow-floating) backdrop-blur-xl backdrop-saturate-150">
          <p role="status" className="min-w-0 flex-1 truncate text-sm text-(--text-secondary)">{saved ? "Agenda salva" : "Salve para aplicar as mudanças"}</p>
          <Button loading={pending} disabled={pending} onClick={save}>Salvar disponibilidade</Button>
        </div>
      </nav>
    </div>
  );
}
