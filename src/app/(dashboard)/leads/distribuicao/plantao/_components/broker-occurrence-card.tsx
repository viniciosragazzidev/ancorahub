"use client";

import { useState, useTransition, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3 } from "lucide-react";
import { DetailDrawer } from "@/components/foundations/detail-drawer";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { assignDutyLeadToBrokerAction, getBrokerDayHistoryAction, getBrokerOccurrenceLeadsAction, getDutyAvailableLeadsAction, setDutyAbsenceAction, setDutyAssignmentAttendanceModeAction } from "@/features/lead-distribution/duty-actions";
import { cn } from "@/lib/utils";
import { BrokerPresenceReleaseButton } from "./broker-presence-release-button";
import { BrokerDayHistoryTrigger } from "./broker-day-history-trigger";
import { BrokerPauseButton } from "./broker-pause-button";
import { BrokerPresenceInviteButton } from "./broker-presence-invite-button";
import { BrokerCapacityBar, BrokerLiveStatus } from "./broker-live-status";
import { DutySwapDoneNotice, DutySwapPicker } from "./duty-swap-picker";
import { swapNoticeText, whatsappStatusLabel, type SwapNotice } from "@/features/lead-distribution/duty-swap";
import type { DutySwapResult } from "@/features/lead-distribution/duty-swap-actions";
import { motionTokens } from "@/components/arc/motion-tokens";
import turnStyles from "./broker-turn.module.css";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const LITE_NO_RECORD_LABEL = "Sem registro";
type LeadResult = Extract<Awaited<ReturnType<typeof getBrokerOccurrenceLeadsAction>>, { ok: true }>;
type AvailableResult = Extract<Awaited<ReturnType<typeof getDutyAvailableLeadsAction>>, { ok: true }>;
type Tab = "received" | "available";

export type BrokerOccurrenceSummary = {
  internalCode: string | null;
  availabilityStatus: string | null;
  presenceEnabled: boolean;
  releasedByName: string | null;
  onlineOverride: boolean;
  notificationErrorCode: string | null;
  liveStatus: import("@/features/lead-distribution/duty-roster-live-status").BrokerLiveOfferStatus;
  nextEventAt: string | null;
  activeLeads: number;
  capacity: number | null;
  crossesCut: boolean;
  leadsMorning: number;
  leadsAfternoon: number;
};

/** Rotation (29/10): where this broker stands in the plantão's turn right now. */
export type BrokerTurn = {
  role: "current" | "next" | "previous" | null;
  /** Place in the queue among those who can receive now (1 = next). */
  position: number | null;
  /** Previous turn: accepted or skipped. */
  outcome?: "accepted" | "skip" | "waiting" | null;
  skips?: number;
};

const TURN_LABEL = { current: "Recebendo agora", next: "Próximo", previous: "Recebeu por último" } as const;
const OUTCOME_LABEL = { accepted: "aceitou", skip: "pulou a vez", waiting: "aguardando" } as const;

export function BrokerOccurrenceCard({ children, directorLite = false, summary, turn = null, scheduleId, leadsSince = "plantao", assignmentId, brokerId, brokerName, phone, presenceStatus, paused, confirmedAt, absent, attendanceMode, onSitePending, branchName = null, canAssignLeads = false, presencePhotoId = null, onSiteReleaseOpen = onSitePending, presenceReleaseNote = null, scheduleAttendanceMode = attendanceMode, canSetAttendanceMode = false, canSwap = false, swapNotice = null }: {
  children?: ReactNode;
  directorLite?: boolean;
  summary?: BrokerOccurrenceSummary;
  turn?: BrokerTurn | null;
  scheduleId: string;
  /** The page's "considerar leads a partir de" choice. */
  leadsSince?: string;
  assignmentId: string;
  brokerId: string;
  brokerName: string;
  phone: string | null;
  presenceStatus: string;
  paused: boolean;
  confirmedAt: string | null;
  absent: boolean;
  /** The mode this broker works the occurrence in (his override, or the plantão's). */
  attendanceMode: string;
  /** The plantão's own mode: a presencial plantão lets the director put one broker online. */
  scheduleAttendanceMode?: string;
  /** Director: can switch this broker between online and presencial in this plantão. */
  canSetAttendanceMode?: boolean;
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
  /** Diretor/Gestor on a slot of the published escala: "Efetuar troca" with a broker of a future plantão. */
  canSwap?: boolean;
  /** This slot came from a swap: who it was swapped with and where this broker was before. */
  swapNotice?: SwapNotice | null;
}) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
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
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapDone, setSwapDone] = useState<Extract<DutySwapResult, { ok: true }> | null>(null);

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
      const result = await getDutyAvailableLeadsAction(scheduleId, leadsSince);
      if (result.ok) setAvailable(result.leads);
      else setAvailableError(result.reason);
    });
  }

  function show() {
    setOpen(true);
    setSwapOpen(false);
    setSwapDone(null);
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

  // "Online neste plantão": only inside a presencial plantão (the others stay presencial).
  const onlineOverride = scheduleAttendanceMode === "presencial" && attendanceMode === "online";
  function changeAttendanceMode() {
    const message = onlineOverride
      ? `Voltar ${brokerName} para presencial? Ele vai precisar tirar a foto do local e esperar a liberação.`
      : `Deixar ${brokerName} online neste plantão? Ele confirma a presença com um toque, sem foto e sem liberação. Os demais seguem presenciais.`;
    if (!window.confirm(message)) return;
    startSaving(async () => {
      const result = await setDutyAssignmentAttendanceModeAction({ scheduleId, assignmentId, mode: onlineOverride ? null : "online" });
      if (result.ok) {
        toast.success(onlineOverride ? `${brokerName} voltou a presencial.` : `${brokerName} está online neste plantão.`);
        setOpen(false);
        router.refresh();
      } else toast.error(result.reason);
    });
  }

  // The plantão page is outside the Lite visual: the turn shows on this card whenever the rotation
  // gives one (29/10); without it the card keeps its exact markup.
  const showTurn = Boolean(turn);
  const cardBody = <>
      <button type="button" onClick={show} className="absolute inset-0 rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir detalhes de ${brokerName} neste plantão`} />
      <div className="pointer-events-none relative z-10 flex w-full items-center justify-between gap-3 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {directorLite && summary ? (
          <div className="flex min-w-0 w-full items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{brokerName}</span>
            {swapNotice ? <Badge variant="info" title={swapNoticeText(swapNotice)}>Troca feita</Badge> : null}
            {summary.onlineOverride ? <Badge variant="info" title="Online neste plantão presencial: confirma com um toque, sem foto">Online</Badge> : null}
            {summary.presenceEnabled && presenceStatus === "confirmed" ? <Badge variant="success" aria-label={`${summary.releasedByName ? `Liberado por ${summary.releasedByName}` : "Presença confirmada"}${confirmedAt ? ` às ${dateTime.format(new Date(confirmedAt))}` : ""}`} title={`${summary.releasedByName ? `Liberado por ${summary.releasedByName}` : "Confirmado"}${confirmedAt ? ` em ${dateTime.format(new Date(confirmedAt))}` : ""}`}><CheckCircle2 className="size-3.5" aria-hidden="true" /></Badge> : null}
            {summary.presenceEnabled && presenceStatus === "pending" ? <Badge variant="warning" aria-label="Aguardando confirmação" title={summary.notificationErrorCode ? "Não foi possível enviar o lembrete" : "Aguardando confirmação"}><Clock3 className="size-3.5" aria-hidden="true" /></Badge> : null}
            {summary.presenceEnabled && attendanceMode !== "presencial" && !absent ? <BrokerPresenceInviteButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} /> : null}
            {attendanceMode === "presencial" && presencePhotoId && onSitePending && !absent ? <Badge variant="warning">Foto para validar</Badge> : null}
            {(summary.presenceEnabled || attendanceMode === "presencial") && presenceStatus === "pending" && !absent && !(attendanceMode === "presencial" && presencePhotoId) ? <BrokerPresenceReleaseButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} inUnit={attendanceMode === "presencial"} /> : null}
            {!absent && !onSitePending ? <BrokerPauseButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} paused={paused} /> : null}
          </div>
          <p className="text-xs text-muted-foreground">{summary.internalCode ? `Código ${summary.internalCode}` : "Sem código"} · {branchName ?? "Sem unidade"} · {summary.availabilityStatus ?? LITE_NO_RECORD_LABEL}{summary.presenceEnabled && summary.releasedByName ? ` · Liberado por ${summary.releasedByName}` : ""}</p>
          <div className="mt-1.5"><BrokerLiveStatus status={summary.liveStatus} nextEventAt={summary.nextEventAt} /></div>
          <BrokerCapacityBar activeLeads={summary.activeLeads} capacity={summary.capacity} />
        </div>
        {summary.crossesCut ? <div className="flex shrink-0 items-center gap-1.5" aria-label={`${summary.leadsMorning} leads de manhã e ${summary.leadsAfternoon} à tarde neste plantão`}>
          <Badge variant="info" title="Leads recebidos de manhã neste plantão">Manhã {summary.leadsMorning}</Badge>
          <Badge variant="destructive" title="Leads recebidos à tarde neste plantão">Tarde {summary.leadsAfternoon}</Badge>
        </div> : <Badge variant="outline" title="Leads recebidos neste plantão">{summary.leadsMorning + summary.leadsAfternoon} leads</Badge>}
          </div>
        ) : children}
    </div>
  </>;
  const turnRole = turn?.role ?? null;
  return <>
    {/* layout: when the turn moves, the cards slide to their new place in the queue (29/10). */}
    {showTurn ? (
    <motion.div
      layout={reduceMotion ? false : "position"}
      transition={reduceMotion ? { duration: 0 } : motionTokens.spring.smooth}
      data-turn={turnRole ?? undefined}
      className={cn("relative flex flex-col gap-2 rounded-[var(--radius-card)] border border-border/70 px-3 py-2.5", turnStyles.card)}
    >
      {turn && (turnRole || turn.position) ? (
        <div className="pointer-events-none relative z-10 flex items-center gap-2">
          <motion.span
            key={`${turnRole ?? "queue"}:${turn.position ?? ""}`}
            className={turnStyles.turnBadge}
            data-turn={turnRole ?? "queue"}
            initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
          >
            {turnRole === "current" ? <span className={turnStyles.liveDot} aria-hidden="true" /> : null}
            {turnRole ? TURN_LABEL[turnRole] : `${turn.position}º na vez`}
            {turnRole === "previous" && turn.outcome ? ` · ${OUTCOME_LABEL[turn.outcome]}` : null}
          </motion.span>
          {turn.skips ? <span className={turnStyles.skips}>{turn.skips} {turn.skips === 1 ? "pulo" : "pulos"} hoje</span> : null}
        </div>
      ) : null}
      {cardBody}
    </motion.div>
    ) : (
    <div className="relative flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/70 px-3 py-2.5">
      {cardBody}
    </div>
    )}
    <DetailDrawer open={open} onOpenChange={setOpen} size="lg" title={brokerName} description={`${branchName ?? "Sem unidade"} · corretor nesta ocorrência do plantão`} summary={<div className="flex flex-wrap gap-2">
      <Badge variant={absent ? "destructive" : presenceStatus === "confirmed" ? "success" : "warning"}>{absent ? "Faltou" : presenceStatus === "confirmed" ? "Presença confirmada" : "Aguardando presença"}</Badge>
      <Badge variant="outline">{paused || onSitePending ? "Pausado" : "Ativo"}</Badge>
      {swapNotice ? <Badge variant="info" title={swapNoticeText(swapNotice)}>Troca feita</Badge> : null}
      <Badge variant={onlineOverride ? "info" : "outline"}>{attendanceMode === "presencial" ? "Presencial" : onlineOverride ? "Online neste plantão" : "Online"}</Badge>
      {presencePhotoId ? <a href={`/api/duty/presence/photo?id=${presencePhotoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-muted">Ver foto do local</a> : null}
      <Badge variant="outline" className="tabular-nums" title="Ofertas enviadas a este corretor neste plantão hoje / aceitas por ele">
        {offers ? `${offers.offered} ${offers.offered === 1 ? "oferta enviada" : "ofertas enviadas"} / ${offers.accepted} ${offers.accepted === 1 ? "aceita" : "aceitas"}` : "Ofertas…"}
      </Badge>
    </div>} footer={<div className="flex flex-wrap justify-end gap-2">
      {attendanceMode === "presencial" && onSitePending && onSiteReleaseOpen && !absent ? <BrokerPresenceReleaseButton scheduleId={scheduleId} assignmentId={assignmentId} brokerName={brokerName} inUnit withPhoto={Boolean(presencePhotoId)} /> : null}
      {canSwap && !swapOpen ? <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => { setSwapDone(null); setSwapOpen(true); }}>Efetuar troca</Button> : null}
      {canSetAttendanceMode && scheduleAttendanceMode === "presencial" && !absent ? <Button type="button" size="sm" variant="outline" disabled={saving} onClick={changeAttendanceMode}>{onlineOverride ? "Voltar a presencial" : "Online neste plantão"}</Button> : null}
      <Button type="button" size="sm" variant={absent ? "outline" : "destructive"} disabled={saving} onClick={changeAbsence}>{absent ? "Desfazer falta" : "Marcar falta"}</Button>
    </div>}>
      {swapDone ? <DutySwapDoneNotice result={swapDone} /> : null}
      {swapOpen ? <DutySwapPicker assignmentId={assignmentId} onCancel={() => setSwapOpen(false)} onSwapped={(result) => {
        setSwapOpen(false);
        setSwapDone(result);
        toast.success(`Troca feita entre ${result.source.brokerName} e ${result.target.brokerName}.`);
        router.refresh();
      }} /> : null}
      {swapNotice && !swapDone ? <p role="status" className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs">
        <span className="font-medium">{swapNoticeText(swapNotice)}</span> {whatsappStatusLabel(swapNotice.whatsappStatus)}.
      </p> : null}
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
