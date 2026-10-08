"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { Agenda } from "./agenda";
import { DayMetrics } from "./day-metrics";
import { DutyCard } from "./duty-card";
import { statusSentence } from "./format";
import { NextAction } from "./next-action";

function GoalRow({ goal }: { goal: NonNullable<BrokerWorkspaceData["goal"]> }) {
  const percentage = Math.min(100, Math.max(0, Math.round(goal.percentage)));
  return (
    <section aria-labelledby="goal-heading" className="arc-venancor flex flex-col gap-3 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="goal-heading" className="text-base font-semibold text-(--foreground)">Sua meta do mês</h2>
        <span className="text-sm font-medium tabular-nums text-(--accent-strong)">{percentage}% concluída</span>
      </div>
      <p className="truncate text-sm text-(--text-secondary)">{goal.name}</p>
      <div
        role="progressbar"
        aria-label={`Progresso da meta ${goal.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-2 w-full overflow-hidden rounded-full bg-(--surface-muted)"
      >
        <div className="h-full rounded-full bg-(--accent)" style={{ width: `${percentage}%` }} />
      </div>
    </section>
  );
}

/** Início of the broker app: greeting, plantão, the day in four numbers, what to do now, agenda and goal. */
export function LightDashboard({ data, greeting }: { data: BrokerWorkspaceData; greeting: string }) {
  const firstName = data.viewer.name.split(" ")[0] || "Corretor";

  return (
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={data.viewer.availabilityStatus} />

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pb-6 pt-2 sm:px-6">
        <header className="arc-venancor">
          <h1 className="text-2xl font-bold tracking-tight text-(--foreground)">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-(--text-secondary)">{statusSentence(data.today)}</p>
        </header>

        <DutyCard data={data} />
        <NextAction action={data.nextAction} />
        <DayMetrics today={data.today} />
        <Agenda items={data.agenda} />
        {data.goal ? <GoalRow goal={data.goal} /> : null}
      </div>
    </div>
  );
}

/** Shown when the workspace data could not be loaded. */
export function LightDashboardUnavailable() {
  const router = useRouter();
  return (
    <div className="arc-venancor mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
      <EmptyState
        title="Não foi possível carregar o seu início"
        description="Verifique a conexão e tente de novo. Seus leads continuam disponíveis na fila."
        action={<Button variant="secondary" onClick={() => router.refresh()}>Tentar de novo</Button>}
      />
    </div>
  );
}
