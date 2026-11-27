"use client";

/**
 * Cartão e gaveta do corretor na página do plantão (27/11/2026, artifact "Página do plantão"). O cartão fica limpo
 * (avatar, nome, presença, situação ao vivo, atendimento e leads); toda ação mora na gaveta: foto do local com
 * validar e liberar, liberar sem foto com motivo, pré-confirmar o próximo turno, atribuir lead, leads recebidos,
 * efetuar troca, pausar e, no ⋯, convite de presença, online neste plantão, falta e ligar. Nenhuma ação do cartão
 * antigo se perdeu; as mesmas server actions, com o retorno do plantão (plantaoDone/plantaoFailed).
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCountdown } from "@/components/lite/status/use-countdown";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import {
  assignDutyLeadToBrokerAction,
  getBrokerDayHistoryAction,
  getBrokerOccurrenceLeadsAction,
  getDutyAvailableLeadsAction,
  preconfirmContiguousDutyPresenceAction,
  releaseDutyPresenceAction,
  sendDutyPresenceInviteManuallyAction,
  setDutyAbsenceAction,
  setDutyAssignmentAttendanceModeAction,
  toggleDutyRosterPauseAction,
} from "@/features/lead-distribution/duty-actions";
import { swapNoticeText, whatsappStatusLabel, type SwapNotice } from "@/features/lead-distribution/duty-swap";
import type { DutySwapResult } from "@/features/lead-distribution/duty-swap-actions";
import type { BrokerLiveOfferStatus } from "@/features/lead-distribution/duty-roster-live-status";

import { plantaoDone, plantaoFailed } from "./plantao-feedback";
import { DotsIcon, PlConfirm, PlMenu, PlSection, PlSheet, initials, pl } from "./plantoes-1a1-kit";
import { PlantaoPager } from "./plantao-pagina-1a1";
import { BrokerDayHistoryTrigger } from "./broker-day-history-trigger";
import { DutySwapDoneNotice, DutySwapPicker } from "./duty-swap-picker";
import type { BrokerTurn } from "./broker-occurrence-card";
import pp from "./plantao-pagina-1a1.module.css";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
const fmt = (value: string | null) => (value ? dateTime.format(new Date(value)).replace(",", " às") : null);
type LeadResult = Extract<Awaited<ReturnType<typeof getBrokerOccurrenceLeadsAction>>, { ok: true }>;
type AvailableResult = Extract<Awaited<ReturnType<typeof getDutyAvailableLeadsAction>>, { ok: true }>;

const LIVE: Record<BrokerLiveOfferStatus, { label: string; cls: string; dot: string }> = {
  ready: { label: "Livre para receber", cls: pl.bGood, dot: "var(--success)" },
  offer_pending: { label: "Oferta enviada", cls: pl.bInfo, dot: "var(--d-action)" },
  cooldown: { label: "Próximo lead em", cls: pl.bWarn, dot: "var(--warning)" },
  start_interval: { label: "Intervalo de início", cls: pl.bInfo, dot: "var(--d-action)" },
  capacity_full: { label: "No limite", cls: pl.bWarn, dot: "var(--warning)" },
  paused: { label: "Em pausa", cls: "", dot: "var(--text-muted)" },
  blocked: { label: "Indisponível", cls: pl.bBad, dot: "var(--danger)" },
};

function countdown(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function LiveBadge({ status, nextEventAt, receiving }: { status: BrokerLiveOfferStatus; nextEventAt: string | null; receiving: boolean }) {
  const remaining = useCountdown(nextEventAt);
  const ui = receiving ? { label: "Recebendo agora", cls: pl.bInfo, dot: "var(--d-action)" } : LIVE[status];
  const ticking = !receiving && remaining !== null && remaining > 0 && (status === "cooldown" || status === "offer_pending");
  return <span className={cn(pl.badge, ui.cls)}><span className={pl.dot} style={{ background: ui.dot }} aria-hidden="true" />{ui.label}{ticking ? <span className={pl.num}>{countdown(remaining ?? 0)}</span> : null}</span>;
}

const ASSIGN_PER_PAGE = 8;
const TEMPERATURE_PT: Record<string, string> = { hot: "quente", warm: "morno", cold: "frio" };

export type BrokerOccurrence1a1Props = {
  scheduleId: string;
  leadsSince: string;
  assignmentId: string;
  brokerId: string;
  brokerName: string;
  phone: string | null;
  internalCode: string | null;
  branchName: string | null;
  availabilityStatus: string | null;
  presenceEnabled: boolean;
  presenceStatus: string;
  confirmedAt: string | null;
  releasedByName: string | null;
  presenceReleaseNote: string | null;
  notificationErrorCode: string | null;
  paused: boolean;
  absent: boolean;
  attendanceMode: string;
  scheduleAttendanceMode: string;
  onlineOverride: boolean;
  canSetAttendanceMode: boolean;
  onSitePending: boolean;
  onSiteReleaseOpen: boolean;
  presencePhotoId: string | null;
  photoMinutesAgo: number | null;
  canAssignLeads: boolean;
  canSwap: boolean;
  swapNotice: SwapNotice | null;
  liveStatus: BrokerLiveOfferStatus;
  nextEventAt: string | null;
  activeLeads: number;
  capacity: number | null;
  crossesCut: boolean;
  leadsMorning: number;
  leadsAfternoon: number;
  blockedReason: string | null;
  wholeDay: boolean;
  turn: BrokerTurn | null;
  preconfirm: { targetAssignmentId: string; targetScheduleName: string } | null;
};

export function BrokerOccurrence1a1(props: BrokerOccurrence1a1Props) {
  const { scheduleId, leadsSince, assignmentId, brokerId, brokerName, phone, absent, paused, onSitePending, attendanceMode, presencePhotoId } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<LeadResult["leads"] | null>(null);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableResult["leads"] | null>(null);
  const [assignPage, setAssignPage] = useState(1);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [offers, setOffers] = useState<{ offered: number; accepted: number } | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapDone, setSwapDone] = useState<Extract<DutySwapResult, { ok: true }> | null>(null);
  const [confirm, setConfirm] = useState<"absence" | "mode" | null>(null);
  const [releaseNote, setReleaseNote] = useState("");
  const [preconfirmMessage, setPreconfirmMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadingLeads, startLeads] = useTransition();
  const [loadingAvailable, startAvailable] = useTransition();

  const onlineOverride = props.scheduleAttendanceMode === "presencial" && attendanceMode === "online";
  const presencial = attendanceMode === "presencial";
  const pending = props.presenceStatus === "pending";
  const receiving = props.turn?.role === "current";
  const turnRole = absent ? null : props.turn?.role ?? null;
  const position = receiving ? "Agora" : props.turn?.position ? `${props.turn.position}º` : null;

  function loadReceived() {
    setLeads(null);
    setLeadsError(null);
    startLeads(async () => {
      const result = await getBrokerOccurrenceLeadsAction(scheduleId, brokerId);
      if (result.ok) setLeads(result.leads);
      else setLeadsError(result.reason);
    });
  }
  function loadAvailable() {
    setAvailable(null);
    setAvailableError(null);
    startAvailable(async () => {
      const result = await getDutyAvailableLeadsAction(scheduleId, leadsSince);
      if (result.ok) { setAvailable(result.leads); setAssignPage(1); }
      else setAvailableError(result.reason);
    });
  }
  function loadOffers() {
    setOffers(null);
    void getBrokerDayHistoryAction(scheduleId, brokerId).then((result) => {
      if (result.ok) setOffers({ offered: result.history.summary.offered, accepted: result.history.summary.accepted });
    }).catch(() => undefined);
  }
  function show() {
    setOpen(true);
    setSwapOpen(false);
    setSwapDone(null);
    setPreconfirmMessage(null);
    loadReceived();
    loadOffers();
    if (props.canAssignLeads && !absent) loadAvailable();
  }

  /** Uma ação por vez; o retorno só vem depois do servidor (FEEDBACK.md). */
  async function run(key: string, action: () => Promise<{ ok: boolean; reason?: string }>, done: string, close = false) {
    setBusy(key);
    try {
      const result = await action();
      if (!result.ok) { plantaoFailed(result.reason ?? "", "Não consegui atualizar o plantão agora."); return; }
      plantaoDone(done);
      if (close) setOpen(false);
      router.refresh();
    } catch {
      plantaoFailed("", "Não consegui atualizar o plantão agora.");
    } finally {
      setBusy(null);
    }
  }

  const togglePause = () => run("pause", async () => {
    const result = await toggleDutyRosterPauseAction(scheduleId, assignmentId, !paused);
    return result.success ? { ok: true } : { ok: false, reason: result.error };
  }, paused ? `${brokerName} retomado.` : `${brokerName} pausado. Não recebe leads automáticos neste plantão.`);
  const release = (withNote: string | null, withPhoto: boolean) => run("release", () => releaseDutyPresenceAction(scheduleId, assignmentId, withNote),
    withPhoto ? `Foto validada. ${brokerName} já pode receber leads.` : presencial ? `${brokerName} liberado(a) sem foto. O motivo ficou registrado.` : `${brokerName} liberado(a) no plantão.`);
  const invite = () => run("invite", () => sendDutyPresenceInviteManuallyAction(scheduleId, assignmentId), `Convite enviado para ${brokerName}.`);
  const absence = () => run("absence", () => setDutyAbsenceAction(scheduleId, assignmentId, !absent), absent ? "Falta desfeita." : "Falta registrada.", true);
  const mode = () => run("mode", () => setDutyAssignmentAttendanceModeAction({ scheduleId, assignmentId, mode: onlineOverride ? null : "online" }),
    onlineOverride ? `${brokerName} voltou a presencial.` : `${brokerName} está online neste plantão.`, true);

  async function preconfirmNext() {
    if (!props.preconfirm) return;
    setBusy("preconfirm");
    try {
      const result = await preconfirmContiguousDutyPresenceAction(scheduleId, assignmentId, props.preconfirm.targetAssignmentId);
      if (!result.ok) { setPreconfirmMessage({ text: result.reason, ok: false }); return; }
      setPreconfirmMessage({ text: "Esse turno já está confirmado.", ok: true });
      window.setTimeout(() => router.refresh(), 1200);
    } catch {
      setPreconfirmMessage({ text: "Não foi possível confirmar agora. Tente novamente.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function assign(lead: AvailableResult["leads"][number]) {
    setAssigningId(lead.id);
    const result = await assignDutyLeadToBrokerAction(scheduleId, brokerId, lead.id);
    setAssigningId(null);
    if (!result.ok) {
      plantaoFailed(result.reason, "Não consegui atualizar o plantão agora.");
      loadAvailable();
      return;
    }
    plantaoDone(`${lead.name} enviado para ${brokerName}.`);
    setAvailable((current) => current?.filter((item) => item.id !== lead.id) ?? null);
    loadReceived();
    loadOffers();
    router.refresh();
  }

  // Selo de presença do cartão.
  const presence = absent ? { label: "Faltou", cls: "" }
    : presencial && presencePhotoId && onSitePending ? { label: "Foto para validar", cls: pl.bWarn }
      : !props.presenceEnabled && !presencial ? null
        : props.presenceStatus === "confirmed" ? { label: props.releasedByName ? `Liberado por ${props.releasedByName.split(/\s+/)[0]}` : "Confirmado", cls: pl.bGood }
          : { label: props.notificationErrorCode ? "Lembrete não enviado" : "Aguardando confirmação", cls: pl.bWarn };
  const warn = props.blockedReason
    ?? (presencial && presencePhotoId && onSitePending && !absent ? `Foto enviada${props.photoMinutesAgo !== null ? ` há ${props.photoMinutesAgo} min` : ""}, valide na gaveta` : null);
  const total = props.leadsMorning + props.leadsAfternoon;
  const leadsLine = props.crossesCut ? `Manhã ${props.leadsMorning} · Tarde ${props.leadsAfternoon}` : total ? `${total} ${total === 1 ? "lead" : "leads"} neste plantão` : "Nenhum lead ainda";
  const meta = [props.internalCode ? `Código ${props.internalCode}` : "Sem código", props.branchName ?? "Sem unidade", props.wholeDay ? "Dia todo" : null].filter(Boolean).join(" · ");
  const capRatio = props.capacity ? Math.min(1, props.activeLeads / props.capacity) : 0;

  const canRelease = (props.presenceEnabled || presencial) && pending && !absent;
  const releaseWithPhoto = presencial && Boolean(presencePhotoId) && onSitePending && props.onSiteReleaseOpen;
  const releaseWithoutPhoto = presencial && !presencePhotoId && canRelease;
  const releaseOnline = !presencial && canRelease;

  return (
    <>
      <button type="button" className={cn(pp.bc, (absent || paused || onSitePending) && pp.bcOff, turnRole === "current" && pp.bcNow, turnRole === "next" && pp.bcNext)} onClick={show} aria-label={`Abrir ${brokerName} neste plantão`}>
        {turnRole === "current" ? <span key="now" className={cn(pp.turnTag, pp.turnTagNow)}><span className={pp.turnPulse} aria-hidden="true" />Recebendo agora</span>
          : turnRole === "next" ? <span key="next" className={cn(pp.turnTag, pp.turnTagNext)}>Próximo a receber</span>
          : turnRole === "previous" ? <span key="prev" className={cn(pp.turnTag, pp.turnTagPrev)}>{props.turn?.outcome === "skip" ? "Último a receber · pulou a vez" : props.turn?.outcome === "accepted" ? "Último a receber · aceitou" : "Último a receber"}</span>
          : null}
        <span className={pp.bcRow}>
          <span className={pl.av} aria-hidden="true">{initials(brokerName)}</span>
          <span className={pp.bcBody}><span className={pp.bcName}>{brokerName}</span><span className={pp.bcMeta}>{meta}</span></span>
          {position ? <span className={pl.pos}>{position}</span> : null}
        </span>
        <span className={pp.bcBadges}>
          {presence ? <span className={cn(pl.badge, presence.cls)}>{presence.label}</span> : null}
          {absent ? null : <LiveBadge status={props.liveStatus} nextEventAt={props.nextEventAt} receiving={receiving} />}
          {/* Pulos no rodízio (27/11/2026): oferta expirada ou recusada gasta a vez; no 3º o corretor entra em pausa. */}
          {!absent && props.turn ? <span className={cn(pl.badge, (props.turn.skips ?? 0) >= 2 ? pl.bWarn : undefined)} title="Oferta expirada ou recusada gasta a vez; no 3º pulo o corretor entra em pausa.">{(props.turn.skips ?? 0) === 0 ? "Sem pulos" : `${props.turn.skips} de 3 pulos`}</span> : null}
          {props.swapNotice ? <span className={cn(pl.badge, pl.bInfo)} title={swapNoticeText(props.swapNotice)}>Troca feita</span> : null}
          {props.onlineOverride ? <span className={pl.badge}>Online</span> : null}
        </span>
        {warn ? <span className={pp.bcWarn}>{warn}</span> : null}
        <span className={pp.capBox}>
          <span className={pp.capHead}><span>Em atendimento</span><span>{props.capacity !== null ? `${props.activeLeads} de ${props.capacity}` : props.activeLeads}</span></span>
          {props.capacity !== null ? <span className={pp.cap}><span className={cn(pp.capFill, props.activeLeads >= props.capacity && pp.capFull)} style={{ width: `${Math.round(capRatio * 100)}%` }} /></span> : null}
        </span>
        <span className={pp.bcFoot}><span>{leadsLine}</span><span className={pp.bcOpen}>Abrir</span></span>
      </button>

      <PlSheet
        open={open}
        onOpenChange={setOpen}
        width={520}
        lead={<span className={pl.av} style={{ width: 44, height: 44, fontSize: 14 }} aria-hidden="true">{initials(brokerName)}</span>}
        title={brokerName}
        description={`${meta} · corretor nesta ocorrência do plantão`}
        badges={<>
          <span className={cn(pl.badge, absent ? pl.bBad : props.presenceStatus === "confirmed" ? pl.bGood : pl.bWarn)}>{absent ? "Faltou" : props.presenceStatus === "confirmed" ? "Presença confirmada" : "Aguardando presença"}</span>
          <span className={pl.badge}>{paused || onSitePending ? "Pausado" : "Ativo"}</span>
          <span className={cn(pl.badge, onlineOverride && pl.bInfo)}>{presencial ? "Presencial" : onlineOverride ? "Online neste plantão" : "Online"}</span>
          {props.swapNotice ? <span className={cn(pl.badge, pl.bInfo)}>Troca feita</span> : null}
          <span className={cn(pl.badge, pl.num)} title="Ofertas enviadas a este corretor neste plantão hoje e aceitas por ele">{offers ? `${offers.offered} ${offers.offered === 1 ? "oferta" : "ofertas"} · ${offers.accepted} ${offers.accepted === 1 ? "aceita" : "aceitas"}` : "Ofertas…"}</span>
        </>}
        footer={<>
          {props.canSwap && !swapOpen ? <button type="button" className={cn(pl.pill, pl.pillQuiet, pl.pillWide)} disabled={busy !== null} onClick={() => { setSwapDone(null); setSwapOpen(true); }}>Efetuar troca</button> : null}
          {!absent && !onSitePending ? <button type="button" className={cn(pl.pill, pl.pillQuiet, pl.pillWide)} disabled={busy !== null} onClick={togglePause}>{busy === "pause" ? (paused ? "Retomando…" : "Pausando…") : paused ? "Retomar" : "Pausar"}</button> : null}
          <PlMenu
            side="top"
            triggerClassName={pl.iconbtn}
            triggerLabel="Mais ações"
            trigger={<DotsIcon />}
            items={[
              props.presenceEnabled && !presencial && !absent ? { label: "Reenviar convite de presença", onSelect: invite, disabled: busy !== null } : null,
              props.canSetAttendanceMode && props.scheduleAttendanceMode === "presencial" && !absent ? { label: onlineOverride ? "Voltar a presencial" : "Trocar para online neste plantão", onSelect: () => setConfirm("mode"), disabled: busy !== null } : null,
              { label: absent ? "Desfazer falta" : "Marcar falta", danger: !absent, onSelect: () => setConfirm("absence"), disabled: busy !== null },
              phone ? { label: "Ligar", onSelect: () => window.location.assign(`tel:${phone.replace(/\D/g, "")}`) } : null,
            ]}
          />
        </>}
      >
        {swapDone ? <DutySwapDoneNotice result={swapDone} /> : null}
        {swapOpen ? <DutySwapPicker assignmentId={assignmentId} onCancel={() => setSwapOpen(false)} onPassed={() => { setSwapOpen(false); router.refresh(); }} onSwapped={(result) => {
          setSwapOpen(false);
          setSwapDone(result);
          plantaoDone(`Troca feita entre ${result.source.brokerName} e ${result.target.brokerName}.`);
          router.refresh();
        }} /> : null}
        {props.swapNotice && !swapDone ? <p role="status" className={cn(pl.alert, pl.alertWarn)} style={{ background: "var(--d-action-soft)" }}><span><span style={{ fontWeight: 500 }}>{swapNoticeText(props.swapNotice)}</span> {whatsappStatusLabel(props.swapNotice.whatsappStatus)}.</span></p> : null}

        <dl className={pl.dl}>
          <dt>Contato</dt><dd>{phone ?? "Não informado"}</dd>
          <dt>Confirmação</dt><dd>{fmt(props.confirmedAt) ?? "Ainda não confirmada"}</dd>
          <dt>Situação</dt><dd>{props.availabilityStatus ?? "Sem registro"}</dd>
        </dl>
        <BrokerDayHistoryTrigger scheduleId={scheduleId} brokerId={brokerId} brokerName={brokerName} />

        {presencePhotoId ? (
          <PlSection id={`foto-${assignmentId}`} title="Foto do local" aside={onSitePending ? <span className={cn(pl.badge, pl.bWarn, pl.num)}>Para validar{props.photoMinutesAgo !== null ? ` · há ${props.photoMinutesAgo} min` : ""}</span> : null}>
            <a href={`/api/duty/presence/photo?id=${presencePhotoId}`} target="_blank" rel="noopener noreferrer" className={pp.photo} aria-label="Abrir a foto do local em tamanho grande">
              {/* eslint-disable-next-line @next/next/no-img-element -- rota privada da foto, com checagem de acesso */}
              <img src={`/api/duty/presence/photo?id=${presencePhotoId}`} alt={`Foto do local tirada por ${brokerName}`} loading="lazy" />
            </a>
            <p className={pl.small}>{fmt(props.confirmedAt) ? `Tirada em ${fmt(props.confirmedAt)}. ` : ""}O corretor guarda o lugar na vez pela hora da foto. Se a foto não for da unidade, marque falta.</p>
            {releaseWithPhoto && !absent ? (
              <div className={pp.btnRow}>
                <button type="button" className={cn(pl.pill, pl.pillPrimary, pl.pillWide)} disabled={busy !== null} onClick={() => release(null, true)}>{busy === "release" ? "Liberando…" : "Liberar presença"}</button>
                <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={busy !== null} onClick={() => setConfirm("absence")}>Marcar falta</button>
              </div>
            ) : null}
          </PlSection>
        ) : props.presenceReleaseNote ? (
          <p className={pl.p}><span style={{ fontWeight: 500, color: "var(--foreground)" }}>Liberado sem foto.</span> Motivo: {props.presenceReleaseNote}</p>
        ) : presencial && !absent ? <p className={pl.small}>Plantão presencial: a foto do local aparece aqui quando o corretor enviar. Valide a foto e libere.</p> : null}

        {releaseWithoutPhoto ? (
          <PlSection id={`liberar-${assignmentId}`} title="Liberar sem foto" hint="O corretor ainda não enviou a foto do local. Escreva o motivo: ele fica registrado.">
            <textarea className={pp.textarea} value={releaseNote} onChange={(event) => setReleaseNote(event.target.value)} maxLength={300} placeholder="Ex.: vi o corretor na unidade, a câmera dele não abre" aria-label="Motivo para liberar sem foto" />
            <div className={pp.btnRow}>
              <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={busy !== null || releaseNote.trim().length < 5} onClick={() => release(releaseNote.trim(), false)}>{busy === "release" ? "Liberando…" : "Liberar com motivo"}</button>
            </div>
          </PlSection>
        ) : null}
        {releaseOnline ? (
          <PlSection id={`liberar-${assignmentId}`} title="Presença" hint="Libere sem esperar o clique do corretor. Fica registrado quem liberou.">
            <div className={pp.btnRow}>
              <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={busy !== null} onClick={() => release(null, false)}>{busy === "release" ? "Liberando…" : "Liberar no plantão"}</button>
            </div>
          </PlSection>
        ) : null}
        {props.preconfirm ? (
          <PlSection id={`proximo-${assignmentId}`} title="Próximo turno" hint={`Já confirmar a presença em ${props.preconfirm.targetScheduleName}, que começa em seguida.`}>
            <div className={pp.btnRow}>
              <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={busy !== null || Boolean(preconfirmMessage?.ok)} onClick={() => { void preconfirmNext(); }}>{busy === "preconfirm" ? "Confirmando…" : preconfirmMessage?.ok ? "Confirmado" : "Pré-confirmar"}</button>
            </div>
            {preconfirmMessage ? <p role={preconfirmMessage.ok ? "status" : "alert"} className={pl.small}>{preconfirmMessage.text}</p> : null}
          </PlSection>
        ) : null}

        <PlSection id={`atribuir-${assignmentId}`} title="Atribuir lead" aside={props.canAssignLeads && !absent ? <button type="button" className={cn(pl.pill, pl.pillSm, pl.pillGhost)} disabled={loadingAvailable} onClick={loadAvailable}>Atualizar</button> : null}
          hint={absent ? "Corretor marcado com falta: desfaça a falta para atribuir leads." : paused || onSitePending ? "Corretor pausado: retome-o para atribuir leads." : !props.canAssignLeads ? "As ações de gestão de leads estão desativadas pelo Super-admin." : "Leads sem corretor nas filas deste plantão, mais antigos primeiro."}>
          {props.canAssignLeads && !absent ? (
            <>
              {loadingAvailable && !available ? <p className={pl.small}>Carregando leads…</p> : null}
              {availableError ? <p role="alert" className={cn(pl.small, pl.dangerText)}>{availableError}</p> : null}
              {available?.length ? (
                <>
                <ul className={cn(pl.rows, pp.assignList)}>
                  {available.slice((assignPage - 1) * ASSIGN_PER_PAGE, assignPage * ASSIGN_PER_PAGE).map((lead) => (
                    <li key={lead.id} className={pp.pillRow}>
                      <span className={pp.pillBody}><Link href={`/leads/${lead.id}`} className={pp.pillName} style={{ color: "var(--foreground)", textDecoration: "none" }}>{lead.name}</Link><span className={pp.pillMeta}>Entrou {fmt(lead.createdAt)} · {lead.queueName ?? "Sem fila"}{lead.temperature ? ` · ${TEMPERATURE_PT[lead.temperature.toLowerCase()] ?? lead.temperature}` : ""}</span></span>
                      {!paused && !onSitePending ? <button type="button" className={cn(pl.pill, pl.pillQuiet, pl.pillSm)} disabled={assigningId !== null} onClick={() => { void assign(lead); }} aria-label={`Enviar ${lead.name} para ${brokerName}`}>{assigningId === lead.id ? "Enviando…" : "Atribuir"}</button> : null}
                    </li>
                  ))}
                </ul>
                {available.length > ASSIGN_PER_PAGE ? (
                  <div className={pp.assignFoot}>
                    <span className={pl.num}>{(assignPage - 1) * ASSIGN_PER_PAGE + 1} a {Math.min(assignPage * ASSIGN_PER_PAGE, available.length)} de {available.length}</span>
                    <PlantaoPager page={assignPage} totalPages={Math.ceil(available.length / ASSIGN_PER_PAGE)} onPage={setAssignPage} label="Páginas dos leads para atribuir" />
                  </div>
                ) : null}
                </>
              ) : available ? <p className={pl.emptyBox}>Nenhum lead aguardando corretor nas filas deste plantão.</p> : null}
            </>
          ) : null}
        </PlSection>

        <PlSection id={`recebidos-${assignmentId}`} title={<>Leads recebidos neste plantão {leads ? <span className={cn(pl.badge, pl.num)} style={{ marginLeft: 8 }}>{leads.length}</span> : null}</>}>
          {loadingLeads && !leads ? <p className={pl.small}>Carregando leads…</p> : null}
          {leadsError ? <p role="alert" className={cn(pl.small, pl.dangerText)}>{leadsError}</p> : null}
          {leads?.length ? (
            <ul className={pl.rows}>
              {leads.map((lead) => (
                <li key={lead.id} className={pp.pillRow}>
                  <span className={pp.pillBody}><Link href={`/leads/${lead.id}`} className={pp.pillName} style={{ color: "var(--foreground)", textDecoration: "none" }}>{lead.name}</Link><span className={pp.pillMeta}>Recebido {fmt(lead.assignedAt) ?? "sem registro"} · 1º contato {fmt(lead.firstContactAt) ?? "pendente"}{lead.queueName ? ` · ${lead.queueName}` : ""}</span></span>
                  <span className={pl.badge}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</span>
                </li>
              ))}
            </ul>
          ) : leads ? <p className={pl.emptyBox}>Nenhum lead recebido nesta ocorrência.</p> : null}
        </PlSection>
      </PlSheet>

      <PlConfirm
        open={confirm === "absence"}
        onOpenChange={(value) => { if (!value) setConfirm(null); }}
        title={absent ? "Desfazer a falta?" : "Marcar falta?"}
        description={absent ? `${brokerName} volta a poder receber leads nesta ocorrência.` : `${brokerName} deixa de receber leads neste plantão.`}
        confirmLabel={busy === "absence" ? "Salvando…" : absent ? "Desfazer falta" : "Marcar falta"}
        danger={!absent}
        pending={busy !== null}
        onConfirm={() => { setConfirm(null); void absence(); }}
      />
      <PlConfirm
        open={confirm === "mode"}
        onOpenChange={(value) => { if (!value) setConfirm(null); }}
        title={onlineOverride ? "Voltar a presencial?" : "Deixar online neste plantão?"}
        description={onlineOverride ? `${brokerName} vai precisar tirar a foto do local e esperar a liberação.` : `${brokerName} confirma a presença com um toque, sem foto e sem liberação. Os demais seguem presenciais.`}
        confirmLabel={onlineOverride ? "Voltar a presencial" : "Deixar online"}
        pending={busy !== null}
        onConfirm={() => { setConfirm(null); void mode(); }}
      />
    </>
  );
}
