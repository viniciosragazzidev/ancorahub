"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
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
 * "Escalar corretor" inside the plantão page: the same sheet and actions as the escala (published
 * escala only) for the day of this plantão (the running turn, or the next one), without leaving the
 * page. No day field (29/10): it showed today even on a plantão days ahead.
 */
export function ScheduleEscalarButton({ scheduleId, scheduleName, date, brokers }: {
  scheduleId: string;
  scheduleName: string;
  date: string;
  brokers: Broker[];
}) {
  const router = useRouter();
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
        toast.error("Este plantão não está numa escala publicada nesse dia. Escale pela Escala do mês.");
        return;
      }
      setFound({ occurrence: result.occurrence });
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button type="button" size="sm" onClick={open} disabled={pending}>{pending ? "Abrindo..." : "Escalar corretor"}</Button>
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
