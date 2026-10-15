"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SearchAddList } from "@/components/ui/search-add-list";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import {
  addBrokerToPublishedOccurrenceAction,
  removeBrokerFromPublishedOccurrenceAction,
  type MonthlyDutyPlanView,
} from "@/features/lead-distribution/monthly-duty-actions";

import type { PlanOccurrence } from "./plantao-occurrence";

type Broker = { id: string; name: string; internalCode: string | null; branchId: string | null };

const ORIGIN_LABEL: Record<string, string> = { weekly: "Escala semanal", manual: "Escalado agora", existing: "Na escala", generated: "Na escala" };

/**
 * A plantão of the published escala, opened from the calendar: who is on it, add a
 * broker (with the unit confirmation), take one off (with confirmation). Both go to
 * the same actions as the planner; the new view replaces the one on screen.
 */
export function PlantaoOccurrenceSheet({
  open,
  onOpenChange,
  occurrence,
  scheduleName,
  brokers,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrence: PlanOccurrence;
  scheduleName: string;
  brokers: Broker[];
  onChanged: (view: MonthlyDutyPlanView) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmOutside, setConfirmOutside] = useState<Broker | null>(null);

  const escalated = new Set(occurrence.brokers.map((item) => item.id));
  const candidates = brokers
    .filter((broker) => !escalated.has(broker.id))
    .map((broker) => ({ id: broker.id, label: broker.name, hint: broker.internalCode ? `Código ${broker.internalCode}` : undefined, keywords: broker.internalCode ?? undefined }));
  const day = `${occurrence.dutyDate.slice(8, 10)}/${occurrence.dutyDate.slice(5, 7)}`;
  const canRemove = !occurrence.ended && !occurrence.started;

  function run(task: () => Promise<MonthlyDutyPlanView>, success: string) {
    startTransition(async () => {
      try {
        onChanged(await task());
        toast.success(success);
        setConfirmRemoveId(null);
        setConfirmOutside(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o plantão.");
      }
    });
  }

  function add(broker: Broker, force: boolean) {
    run(() => addBrokerToPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId: broker.id, force }), `${broker.name} escalado.`);
  }

  function requestAdd(item: { id: string }) {
    const broker = brokers.find((candidate) => candidate.id === item.id);
    if (!broker) return;
    // The unit confirmation mirrors the server rule (the plantão's allowed brokers).
    if (!occurrence.allowedBrokerIds.includes(broker.id)) {
      setConfirmOutside(broker);
      return;
    }
    add(broker, false);
  }

  function remove(brokerId: string, name: string) {
    run(() => removeBrokerFromPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId }), `${name} saiu do plantão.`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{scheduleName} · {day}</SheetTitle>
          <SheetDescription>
            {occurrence.startsAt.slice(0, 5)}–{occurrence.endsAt.slice(0, 5)} · {occurrence.assignedCount} escalado{occurrence.assignedCount === 1 ? "" : "s"}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {occurrence.ended ? <p className="text-sm text-muted-foreground">Este plantão já terminou. Não dá para mudar a escala dele.</p> : null}
          {!occurrence.ended && occurrence.started ? <p className="text-sm text-muted-foreground">Este plantão está em andamento: dá para escalar, mas não para tirar corretor.</p> : null}

          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Escalados</h3>
            {occurrence.brokers.length ? (
              <ul className="grid gap-2">
                {occurrence.brokers.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.name}{item.code ? ` · ${item.code}` : ""}</span>
                      <span className="text-xs text-muted-foreground">{ORIGIN_LABEL[item.origin] ?? "Na escala"}</span>
                    </span>
                    {canRemove && item.origin !== "weekly" ? (
                      confirmRemoveId === item.id ? (
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(item.id, item.name)}>Confirmar</Button>
                          <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmRemoveId(null)}>Cancelar</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmRemoveId(item.id)}>Tirar do plantão</Button>
                      )
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>}
          </section>

          {!occurrence.ended ? (
            <section className="grid gap-2">
              <h3 className="text-sm font-medium">Escalar corretor</h3>
              {confirmOutside ? (
                <div role="alert" className="grid gap-2 rounded-md border border-warning/50 p-3 text-sm">
                  <p>A unidade de {confirmOutside.name} não participa deste tipo de plantão. Escalar mesmo assim?</p>
                  <span className="flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => add(confirmOutside, true)}>Escalar mesmo assim</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirmOutside(null)}>Cancelar</Button>
                  </span>
                </div>
              ) : null}
              <SearchAddList
                items={candidates}
                placeholder="Buscar corretor por nome ou código"
                emptyLabel="Nenhum corretor encontrado."
                addingId={null}
                disabled={pending}
                onAdd={requestAdd}
              />
            </section>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
