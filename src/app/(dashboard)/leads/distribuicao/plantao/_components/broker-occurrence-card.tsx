"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/foundations/detail-drawer";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { getBrokerOccurrenceLeadsAction, setDutyAbsenceAction } from "@/features/lead-distribution/duty-actions";
import { BrokerPresenceReleaseButton } from "./broker-presence-release-button";
import { BrokerDayHistoryTrigger } from "./broker-day-history-trigger";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
type LeadResult = Extract<Awaited<ReturnType<typeof getBrokerOccurrenceLeadsAction>>, { ok: true }>;

export function BrokerOccurrenceCard({ children, scheduleId, assignmentId, brokerId, brokerName, phone, presenceStatus, paused, confirmedAt, absent, attendanceMode, onSitePending }: {
  children: ReactNode;
  scheduleId: string;
  assignmentId: string;
  brokerId: string;
  brokerName: string;
  phone: string | null;
  presenceStatus: string;
  paused: boolean;
  confirmedAt: string | null;
  absent: boolean;
  attendanceMode: string;
  onSitePending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<LeadResult["leads"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const router = useRouter();

  function show() {
    setOpen(true);
    setLeads(null);
    setError(null);
    startLoading(async () => {
      const result = await getBrokerOccurrenceLeadsAction(scheduleId, brokerId);
      if (result.ok) setLeads(result.leads);
      else setError(result.reason);
    });
  }

  function changeAbsence() {
    const message = absent ? `Desfazer a falta de ${brokerName} nesta ocorrência?` : `Marcar falta de ${brokerName} nesta ocorrência? O corretor deixará de receber leads neste plantão.`;
    if (!window.confirm(message)) return;
    startSaving(async () => {
      const result = await setDutyAbsenceAction(scheduleId, assignmentId, !absent);
      if (result.ok) {
        toast.success(absent ? "Falta desfeita." : "Falta registrada.");
        setOpen(false);
        router.refresh();
      } else toast.error(result.reason);
    });
  }

  return <>
    <div className="relative flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 px-3 py-2.5">
      <button type="button" onClick={show} className="absolute inset-0 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir detalhes de ${brokerName} neste plantão`} />
      <div className="pointer-events-none relative z-10 flex w-full items-center justify-between gap-3 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {children}
      </div>
    </div>
    <DetailDrawer open={open} onOpenChange={setOpen} size="lg" title={brokerName} description="Corretor nesta ocorrência do plantão" summary={<div className="flex flex-wrap gap-2">
      <Badge variant={absent ? "destructive" : presenceStatus === "confirmed" ? "success" : "warning"}>{absent ? "Faltou" : presenceStatus === "confirmed" ? "Presença confirmada" : "Aguardando presença"}</Badge>
      <Badge variant="outline">{paused || onSitePending ? "Pausado" : "Ativo"}</Badge>
      <Badge variant="outline">{attendanceMode === "presencial" ? "Presencial" : "Online"}</Badge>
    </div>} footer={<div className="flex flex-wrap justify-end gap-2">
      {attendanceMode === "presencial" && onSitePending && !absent ? <BrokerPresenceReleaseButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} inUnit /> : null}
      <Button type="button" size="sm" variant={absent ? "outline" : "destructive"} disabled={saving} onClick={changeAbsence}>{absent ? "Desfazer falta" : "Marcar falta"}</Button>
    </div>}>
      <section className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">Contato:</span> {phone ?? "Não informado"}</p>
        <p><span className="text-muted-foreground">Confirmação:</span> {confirmedAt ? dateTime.format(new Date(confirmedAt)) : "Ainda não confirmada"}</p>
        <BrokerDayHistoryTrigger scheduleId={scheduleId} brokerId={brokerId} brokerName={brokerName} />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Leads recebidos neste plantão {leads ? <Badge variant="outline">{leads.length}</Badge> : null}</h3>
        {loading && !leads ? <p className="text-sm text-muted-foreground">Carregando leads…</p> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {leads?.length ? <ul className="divide-y divide-border rounded-xl border border-border">{leads.map((lead) => <li key={lead.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <Link href={`/leads/${lead.id}`} className="text-sm font-medium underline-offset-4 hover:underline">{lead.name}</Link>
            <p className="text-xs text-muted-foreground">Recebido {lead.assignedAt ? dateTime.format(new Date(lead.assignedAt)) : "—"} · Origem: {lead.origin ?? "—"} · Fila: {lead.queueName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">1º contato: {lead.firstContactAt ? dateTime.format(new Date(lead.firstContactAt)) : "pendente"}</p>
          </div>
          <LeadStatusBadge status={lead.status} />
        </li>)}</ul> : leads ? <p className="text-sm text-muted-foreground">Nenhum lead recebido nesta ocorrência.</p> : null}
      </section>
    </DetailDrawer>
  </>;
}
