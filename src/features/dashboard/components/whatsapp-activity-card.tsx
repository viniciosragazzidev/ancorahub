"use client";

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import type { WhatsAppActivitySummary } from "../whatsapp-activity";

export function WhatsAppActivityCard({ activity }: { activity: WhatsAppActivitySummary }) {
  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Respostas no WhatsApp"
        description="Respostas no WhatsApp dos últimos 7 dias, leads com corretor conectado"
      />
      <div className="grid gap-3 px-5 pb-5 pt-1">
        <h3 aria-label={`${activity.totalLeads} leads responderam nos últimos 7 dias`} className="text-base font-medium leading-snug">
          <span className="mr-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{activity.totalLeads}</span>
          {" "}leads responderam nos últimos 7 dias
        </h3>
        <p className="text-xs text-muted-foreground">
          {activity.connectedBrokerCount} {activity.connectedBrokerCount === 1 ? "corretor conectado" : "corretores conectados"}
        </p>
        {activity.brokers.length ? (
          <ul className="max-h-64 divide-y divide-border overflow-y-auto" aria-label="Leads que responderam por corretor">
            {activity.brokers.map((broker) => (
              <li key={broker.id}>
                <Link
                  href={`/conversas?tab=leads&brokerId=${encodeURIComponent(broker.id)}&respondeu=7d`}
                  aria-label={`${broker.name}, ${broker.leadCount} ${broker.leadCount === 1 ? "lead" : "leads"}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm transition-colors hover:text-ds-electric-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={`Ver conversas de ${broker.name}`}
                >
                  <span className="min-w-0 truncate">{broker.name}</span>
                  <span className="shrink-0 font-mono font-medium tabular-nums">
                    {broker.leadCount} {broker.leadCount === 1 ? "lead" : "leads"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum corretor conectado.</p>
        )}
      </div>
    </Card>
  );
}
