"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/foundations/detail-drawer";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { assignDutyLeadToBrokerAction, getBrokerDayHistoryAction, getBrokerOccurrenceLeadsAction, getDutyAvailableLeadsAction, setDutyAbsenceAction } from "@/features/lead-distribution/duty-actions";
import { cn } from "@/lib/utils";
import { BrokerPresenceReleaseButton } from "./broker-presence-release-button";
import { BrokerDayHistoryTrigger } from "./broker-day-history-trigger";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
type LeadResult = Extract<Awaited<ReturnType<typeof getBrokerOccurrenceLeadsAction>>, { ok: true }>;
type AvailableResult = Extract<Awaited<ReturnType<typeof getDutyAvailableLeadsAction>>, { ok: true }>;
type Tab = "received" | "available";

export function BrokerOccurrenceCard({ children, scheduleId, assignmentId, brokerId, brokerName, phone, presenceStatus, paused, confirmedAt, absent, attendanceMode, onSitePending, branchName = null, canAssignLeads = false, presencePhotoId = null, onSiteReleaseOpen = onSitePending, presenceReleaseNote = null }: {
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
  /** Presencial: the manager's "release" opens 30 min before the start (before that the broker just shows paused). */
  onSiteReleaseOpen?: boolean;
  /** Presencial released without the photo: the reason written by the manager. */
  presenceReleaseNote?: string | null;
  /** The broker's own unit. */
  branchName?: string | null;
  /** Management actions enabled: the "Leads disponíveis" tab can assign. */
  canAssignLeads?: boolean;
  /** Presencial confirmed by the broker with a photo of the place: the confirmation id to open it. */
  presencePhotoId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<LeadResult["leads"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("received");
  const [available, setAvailable] = useState<AvailableResult["leads"] | null>(null);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [loadingAvailable, startLoadingAvailable] = useTransition();
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // Offers sent to this broker in this plantão today, and how many were accepted.
  const [offers, setOffers] = useState<{ offered: number; accepted: number } | null>(null);

  function loadOffers() {
    setOffers(null);
    void getBrokerDayHistoryAction(scheduleId, brokerId).then((result) => {
      if (result.ok) setOffers({ offered: result.history.summary.offered, accepted: result.history.summary.accepted });
    }).catch(() => undefined);
  }

  function loadReceived() {
    setLeads(null);
    setError(null);
    startLoading(async () => {
      const result = await getBrokerOccurrenceLeadsAction(scheduleId, brokerId);
      if (result.ok) setLeads(result.leads);
      else setError(result.reason);
    });
  }

  function loadAvailable() {
    setAvailable(null);
    setAvailableError(null);
    startLoadingAvailable(async () => {
      const result = await getDutyAvailableLeadsAction(scheduleId);
      if (result.ok) setAvailable(result.leads);
      else setAvailableError(result.reason);
    });
  }

  function show() {
    setOpen(true);
    setTab("received");
    setAvailable(null);
    loadReceived();
    loadOffers();
  }

  function chooseTab(next: Tab) {
    setTab(next);
    if (next === "available" && available === null && !loadingAvailable) loadAvailable();
  }

  function assign(lead: AvailableResult["leads"][number]) {
    setAssigningId(lead.id);
    startSaving(async () => {
      const result = await assignDutyLeadToBrokerAction(scheduleId, brokerId, lead.id);
      setAssigningId(null);
      if (!result.ok) {
        toast.error(result.reason);
        loadAvailable();
        return;
      }
      toast.success(`${lead.name} enviado para ${brokerName}.`);
      setAvailable((current) => current?.filter((item) => item.id !== lead.id) ?? null);
      loadReceived();
      loadOffers();
      router.refresh();
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
    <DetailDrawer open={open} onOpenChange={setOpen} size="lg" title={brokerName} description={`${branchName ?? "Sem unidade"} · corretor nesta ocorrência do plantão`} summary={<div className="flex flex-wrap gap-2">
      <Badge variant={absent ? "destructive" : presenceStatus === "confirmed" ? "success" : "warning"}>{absent ? "Faltou" : presenceStatus === "confirmed" ? "Presença confirmada" : "Aguardando presença"}</Badge>
      <Badge variant="outline">{paused || onSitePending ? "Pausado" : "Ativo"}</Badge>
      <Badge variant="outline">{attendanceMode === "presencial" ? "Presencial" : "Online"}</Badge>
      {presencePhotoId ? <a href={`/api/duty/presence/photo?id=${presencePhotoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-muted">Ver foto do local</a> : null}
      <Badge variant="outline" className="tabular-nums" title="Ofertas enviadas a este corretor neste plantão hoje / aceitas por ele">
        {offers ? `${offers.offered} ${offers.offered === 1 ? "oferta enviada" : "ofertas enviadas"} / ${offers.accepted} ${offers.accepted === 1 ? "aceita" : "aceitas"}` : "Ofertas…"}
      </Badge>
    </div>} footer={<div className="flex flex-wrap justify-end gap-2">
      {attendanceMode === "presencial" && onSitePending && onSiteReleaseOpen && !absent ? <BrokerPresenceReleaseButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} inUnit withPhoto={Boolean(presencePhotoId)} /> : null}
      <Button type="button" size="sm" variant={absent ? "outline" : "destructive"} disabled={saving} onClick={changeAbsence}>{absent ? "Desfazer falta" : "Marcar falta"}</Button>
    </div>}>
      <section className="space-y-1 text-sm">
        <p><span className="text-muted-foreground">Contato:</span> {phone ?? "Não informado"}</p>
        <p><span className="text-muted-foreground">Confirmação:</span> {confirmedAt ? dateTime.format(new Date(confirmedAt)) : "Ainda não confirmada"}</p>
        <BrokerDayHistoryTrigger scheduleId={scheduleId} brokerId={brokerId} brokerName={brokerName} />
      </section>
      {presencePhotoId ? (
        <section className="space-y-2" aria-label="Foto do local">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Foto do local</p>
            <p className="text-xs text-muted-foreground">{confirmedAt ? `Tirada em ${dateTime.format(new Date(confirmedAt))}` : null}</p>
          </div>
          {/* Opened only when the drawer is open: the manager checks the broker is really at the unit. */}
          <a href={`/api/duty/presence/photo?id=${presencePhotoId}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border bg-muted/40" aria-label="Abrir a foto do local em tamanho grande">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked photo route */}
            <img src={`/api/duty/presence/photo?id=${presencePhotoId}`} alt={`Foto do local tirada por ${brokerName}`} loading="lazy" className="max-h-80 w-full object-contain" />
          </a>
          <p className="text-xs text-muted-foreground">Se a foto não for da unidade, use &ldquo;Marcar falta&rdquo;.</p>
        </section>
      ) : presenceReleaseNote ? <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs"><span className="font-medium">Liberado sem foto.</span> Motivo: {presenceReleaseNote}</p>
        : attendanceMode === "presencial" && !absent ? <p className="text-xs text-muted-foreground">Plantão presencial: a foto do local aparece aqui quando o corretor enviar. Valide a foto e libere.</p> : null}
      <div role="tablist" aria-label="Leads do corretor" className="grid grid-cols-2 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
        {([["received", "Leads recebidos", leads?.length], ["available", "Leads disponíveis", available?.length]] as const).map(([value, label, count]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => chooseTab(value)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", tab === value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {label}{count !== undefined ? ` · ${count}` : ""}
          </button>
        ))}
      </div>
      {tab === "available" ? <section className="space-y-2" aria-label="Leads disponíveis">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Leads sem corretor nas filas deste plantão, mais antigos primeiro.</p>
          <Button type="button" size="sm" variant="ghost" disabled={loadingAvailable} onClick={loadAvailable}>Atualizar</Button>
        </div>
        {loadingAvailable && !available ? <p className="text-sm text-muted-foreground">Carregando leads…</p> : null}
        {availableError ? <p role="alert" className="text-sm text-destructive">{availableError}</p> : null}
        {available?.length ? <ul className="divide-y divide-border rounded-xl border border-border">{available.map((lead) => <li key={lead.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <Link href={`/leads/${lead.id}`} className="text-sm font-medium underline-offset-4 hover:underline">{lead.name}</Link>
            <p className="text-xs text-muted-foreground">Entrou {dateTime.format(new Date(lead.createdAt))} · Fila: {lead.queueName ?? "—"}{lead.temperature ? ` · ${lead.temperature}` : ""}</p>
          </div>
          {canAssignLeads && !absent && !paused && !onSitePending ? (
            <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={saving} onClick={() => assign(lead)} aria-label={`Enviar ${lead.name} para ${brokerName}`}>
              {assigningId === lead.id ? "Enviando…" : "Enviar ao corretor"}
            </Button>
          ) : null}
        </li>)}</ul> : available ? <p className="text-sm text-muted-foreground">Nenhum lead aguardando corretor nas filas deste plantão.</p> : null}
        {absent ? <p className="text-xs text-muted-foreground">Corretor marcado com falta: desfaça a falta para atribuir leads.</p> : paused || onSitePending ? <p className="text-xs text-muted-foreground">Corretor pausado: retome-o para atribuir leads.</p> : !canAssignLeads ? <p className="text-xs text-muted-foreground">As ações de gestão de leads estão desativadas pelo Super-admin.</p> : null}
      </section> : null}
      {tab === "received" ? <section className="space-y-2">
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
      </section> : null}
    </DetailDrawer>
  </>;
}
