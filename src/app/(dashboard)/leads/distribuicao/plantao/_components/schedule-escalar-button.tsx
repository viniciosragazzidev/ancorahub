"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { getMonthlyDutyPlanAction, type MonthlyDutyPlanView } from "@/features/lead-distribution/monthly-duty-actions";

import { findPublishedOccurrence, type PlanOccurrence } from "./plantao-occurrence";
import { PlantaoOccurrenceSheet } from "./plantao-occurrence-sheet";

type Broker = { id: string; name: string; internalCode: string | null; branchId: string | null };

function previousMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

/**
 * "Escalar corretor" inside the plantão page: pick the day (the current or next turn by default),
 * then the same sheet and actions as the escala (published escala only), without leaving the page.
 */
export function ScheduleEscalarButton({ scheduleId, scheduleName, defaultDate, brokers }: {
  scheduleId: string;
  scheduleName: string;
  defaultDate: string;
  brokers: Broker[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [found, setFound] = useState<{ occurrence: PlanOccurrence } | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      const monthKey = date.slice(0, 7);
      const [current, previous] = await Promise.all([
        getMonthlyDutyPlanAction(monthKey).catch(() => null),
        getMonthlyDutyPlanAction(previousMonth(monthKey)).catch(() => null),
      ]);
      const plans: Record<string, MonthlyDutyPlanView | null> = { [monthKey]: current, [previousMonth(monthKey)]: previous };
      const result = findPublishedOccurrence(plans, scheduleId, date);
      if (!result) {
        toast.error("Este plantão não está numa escala publicada nessa data. Escolha outro dia ou escale pela Escala do mês.");
        return;
      }
      setFound({ occurrence: result.occurrence });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted-foreground">
        Dia
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-auto" aria-label="Dia do plantão para escalar" />
      </label>
      <Button type="button" size="sm" onClick={open} disabled={pending || !date}>{pending ? "Abrindo..." : "Escalar corretor"}</Button>
      {found ? (
        <PlantaoOccurrenceSheet
          open
          onOpenChange={(value) => { if (!value) setFound(null); }}
          occurrence={found.occurrence}
          scheduleName={scheduleName}
          brokers={brokers}
          onChanged={(view) => {
            const next = view.occurrences.find((item) => item.id === found.occurrence.id);
            if (next) setFound({ occurrence: next });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
