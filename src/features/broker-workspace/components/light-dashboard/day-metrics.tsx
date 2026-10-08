"use client";

import Link from "next/link";

import { MetricCard } from "@/components/arc/metric-card/metric-card";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { cn } from "@/lib/utils";

type Today = BrokerWorkspaceData["today"];

const linkClass = "block rounded-3xl";

/** Seu dia: four numbers from the server counters, each one opening the queue on the matching tab. */
export function DayMetrics({ today }: { today: Today }) {
  const atRisk = today.slaAtRiskNow > 0;
  return (
    <section aria-labelledby="day-heading" className="arc-venancor flex flex-col gap-3">
      <h2 id="day-heading" className="text-base font-semibold text-(--foreground)">Seu dia</h2>
      <ul className="grid grid-cols-2 gap-3">
        <li>
          <Link href="/minha-fila" className={linkClass}>
            <MetricCard label="Recebidos" value={today.receivedToday} context="Chegaram hoje" />
          </Link>
        </li>
        <li>
          <Link href="/minha-fila?filter=active" className={linkClass}>
            <MetricCard label="Aceitos" value={today.acceptedToday} context="Você aceitou hoje" />
          </Link>
        </li>
        <li>
          <Link href="/minha-fila?filter=active" className={linkClass}>
            <MetricCard label="Em atendimento" value={today.inServiceNow} context="Agora" />
          </Link>
        </li>
        <li>
          {/* Orange only when there is something at risk; the number and the label carry the meaning. */}
          <Link href="/minha-fila?filter=risk" className={cn(linkClass, atRisk && "[--foreground:var(--warning)]")}>
            <MetricCard label="Prazo em risco" value={today.slaAtRiskNow} context={atRisk ? "Peça atenção" : "Nenhum em risco"} />
          </Link>
        </li>
      </ul>
    </section>
  );
}
