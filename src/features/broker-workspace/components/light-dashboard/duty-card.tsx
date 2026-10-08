"use client";

import { Button } from "@/components/arc/button/button";
import { useLightAvailabilityContext } from "@/components/light/light-availability-context";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { formatDutyDay, formatRemaining, formatTime } from "./format";
import { useMinuteClock } from "./use-minute-clock";

type Duty = NonNullable<BrokerWorkspaceData["duty"]>;

function ActiveDuty({ duty, viewerAvailability }: { duty: NonNullable<Duty["active"]>; viewerAvailability: BrokerWorkspaceData["viewer"]["availabilityStatus"] }) {
  const availabilityContext = useLightAvailabilityContext();
  const now = useMinuteClock();
  // The chrome holds the live availability; the server value is the first paint.
  const availability = availabilityContext?.availability ?? viewerAvailability;
  const availabilityPaused = availability !== "available";

  let status = "Pronto para receber";
  if (duty.paused) status = "Pausado no plantão";
  else if (availabilityPaused) status = "Pausado";
  else if (duty.presenceStatus === "pending") status = "Presença pendente";

  const remainingMs = now ? new Date(duty.endsAt).getTime() - now.getTime() : null;
  // Pausing is the broker own availability; a pause set by the manager on the roster is not theirs to undo.
  const canToggle = Boolean(availabilityContext) && !duty.paused;

  return (
    <section aria-labelledby="duty-heading" className="arc-venancor flex flex-col gap-4 rounded-3xl bg-(--accent) p-5 text-(--accent-foreground)">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="duty-heading" className="text-sm font-medium opacity-90">Plantão agora</h2>
          <p className="mt-1 truncate text-xl font-semibold">{duty.scheduleName}</p>
          <p className="mt-1 text-sm tabular-nums opacity-90">
            {formatTime(duty.startsAt)} às {formatTime(duty.endsAt)}
            {duty.queueName ? ` · Fila ${duty.queueName}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-(--accent-foreground)/16 px-3 py-1 text-sm font-medium">{status}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-h-5 text-sm tabular-nums opacity-90">
          {remainingMs !== null && remainingMs > 0 ? `Termina em ${formatRemaining(remainingMs)}` : ""}
        </p>
        {canToggle ? (
          <Button
            variant="secondary"
            loading={availabilityContext?.isPending}
            disabled={availabilityContext?.isPending}
            onClick={() => availabilityContext?.setStatus(availabilityPaused ? "available" : "paused")}
          >
            {availabilityPaused ? "Retomar" : "Pausar"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function NextDuty({ duty }: { duty: NonNullable<Duty["next"]> }) {
  return (
    <section aria-labelledby="next-duty-heading" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <h2 id="next-duty-heading" className="text-sm text-(--text-secondary)">Próximo plantão</h2>
      <p className="mt-1 truncate text-xl font-semibold text-(--foreground)">{duty.scheduleName}</p>
      <p className="mt-1 text-sm tabular-nums text-(--text-secondary)">
        <span className="capitalize">{formatDutyDay(duty.dutyDate)}</span>, {formatTime(duty.startsAt)} às {formatTime(duty.endsAt)}
        {duty.queueName ? ` · Fila ${duty.queueName}` : ""}
      </p>
    </section>
  );
}

/** Plantão agora (flat accent) when on duty, the next one (neutral) when not, nothing when there is none. */
export function DutyCard({ data }: { data: BrokerWorkspaceData }) {
  const duty = data.duty;
  if (duty?.active) return <ActiveDuty duty={duty.active} viewerAvailability={data.viewer.availabilityStatus} />;
  if (duty?.next) return <NextDuty duty={duty.next} />;
  return null;
}
