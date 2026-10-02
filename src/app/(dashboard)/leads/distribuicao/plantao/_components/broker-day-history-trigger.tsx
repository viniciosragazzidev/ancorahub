"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { DetailDrawer } from "@/components/foundations/detail-drawer";
import { WhatsappLogo } from "@/components/huge-icons";
import { LeadStatusBadge, LeadTemperature } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { getBrokerDayHistoryAction } from "@/features/lead-distribution/duty-actions";
import type { BrokerDayHistory } from "@/features/lead-distribution/broker-day-history";

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const offerStatus: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" | "info" }> = {
  ACCEPTED: { label: "Aceita", variant: "success" },
  DECLINED: { label: "Recusada", variant: "destructive" },
  EXPIRED: { label: "Expirou", variant: "warning" },
  CANCELLED: { label: "Cancelada", variant: "outline" },
  PENDING: { label: "Aguardando", variant: "info" },
  SENT: { label: "Aguardando", variant: "info" },
  DELIVERED: { label: "Aguardando", variant: "info" },
  READ: { label: "Lida", variant: "info" },
};

/** Broker name on the plantão roster: opens their day (since 19:00) in a drawer. */
export function BrokerDayHistoryTrigger({ scheduleId, brokerId, brokerName, dutyDate = null }: { scheduleId: string; brokerId: string; brokerName: string; dutyDate?: string | null }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<BrokerDayHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function show() {
    setOpen(true);
    setError(null);
    startLoading(async () => {
      const result = await getBrokerDayHistoryAction(scheduleId, brokerId, dutyDate);
      if (result.ok) setHistory(result.history);
      else setError(result.reason);
    });
  }

  const s = history?.summary;
  return (
    <>
      <button
        type="button"
        onClick={show}
        className="-mx-1 block max-w-full truncate rounded px-1 text-left text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver o histórico do dia de ${brokerName}`}
      >
        {brokerName}
      </button>
      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={brokerName}
        description={history ? `Histórico do dia · ${dayTime.format(new Date(history.since))} – ${history.until ? dayTime.format(new Date(history.until)) : "agora"}` : "Histórico do dia"}
        summary={s ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Leads recebidos", value: s.received },
              { label: "Com 1º contato", value: s.contacted },
              { label: "Ofertas", value: s.offered },
              { label: "Aceitas", value: s.accepted },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border p-2.5">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      >
        {loading && !history ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
        {error ? <p role="alert" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{error}</p> : null}
        {history ? (
          <>
            <section className="space-y-2" aria-labelledby="broker-day-leads">
              <h3 id="broker-day-leads" className="text-sm font-semibold">Leads recebidos <Badge variant="outline">{history.leads.length}</Badge></h3>
              {history.leads.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {history.leads.map((lead) => (
                    <li key={lead.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Link href={`/leads/${lead.id}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">{lead.name}</Link>
                          {lead.whatsapp ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                              <WhatsappLogo className="size-2.5" weight="fill" /> WhatsApp
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {lead.assignedAt ? `Recebido às ${time.format(new Date(lead.assignedAt))}` : "—"}
                          {lead.queueName ? ` · ${lead.queueName}` : ""}
                          {lead.firstContactAt ? ` · 1º contato às ${time.format(new Date(lead.firstContactAt))}` : " · sem 1º contato"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <LeadTemperature status={lead.qualificationStatus} />
                        <LeadStatusBadge status={lead.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nenhum lead recebido neste dia.</p>}
            </section>

            <section className="space-y-2" aria-labelledby="broker-day-offers">
              <h3 id="broker-day-offers" className="text-sm font-semibold">Ofertas <Badge variant="outline">{history.offers.length}</Badge></h3>
              {s && (s.declined || s.expired || s.pending) ? (
                <p className="text-xs text-muted-foreground">{s.declined} recusada(s) · {s.expired} expirada(s) · {s.pending} aguardando resposta</p>
              ) : null}
              {history.offers.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {history.offers.map((offer) => {
                    const ui = offerStatus[offer.status] ?? { label: offer.status, variant: "outline" as const };
                    return (
                      <li key={offer.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{offer.leadName}</p>
                          <p className="text-xs text-muted-foreground">
                            Oferecido às {time.format(new Date(offer.offeredAt))}
                            {offer.answeredAt ? ` · respondeu às ${time.format(new Date(offer.answeredAt))}` : ""}
                          </p>
                        </div>
                        <Badge variant={ui.variant}>{ui.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nenhuma oferta neste dia.</p>}
            </section>
          </>
        ) : null}
      </DetailDrawer>
    </>
  );
}
