"use client";

import Link from "next/link";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";

const backToQueue =
  "inline-flex h-11 items-center justify-center rounded-full bg-(--surface-muted) px-5 text-sm font-semibold text-(--foreground)";

/** The lead moved to another broker or is already finished: nothing to act on here. */
export function UnavailableLeadView({ availabilityStatus }: { availabilityStatus: "available" | "paused" | "offline" }) {
  return (
    <div className="flex min-h-full flex-col text-foreground">
      <LightAvailabilityBanner initialStatus={availabilityStatus} />
      <div className="arc-venancor mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <EmptyState
          title="Este atendimento foi redistribuído"
          description="Outro corretor assumiu este lead ou ele já foi concluído."
          action={
            <Link href="/minha-fila" className={backToQueue}>
              Voltar para a fila
            </Link>
          }
        />
      </div>
    </div>
  );
}
