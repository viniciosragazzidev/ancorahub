"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { formatDuration } from "@/features/engagement/ranking";
import { addSupervisorNoteAction } from "@/features/supervisor-workspace/notes-actions";
import { SUPERVISOR_NOTE_KIND_LABELS, SUPERVISOR_NOTE_KINDS, type SupervisorNote, type SupervisorNoteKind } from "@/features/supervisor-workspace/notes-types";
import { removeBrokerFromMyTeamAction } from "@/features/supervisor-workspace/my-team-actions";
import { recognizeBrokerAction } from "@/features/journey/recognition-actions";
import { RecognizeSheet } from "@/features/journey/components/recognize-sheet";
import type { MonthlyBrokerMetricPoint } from "@/features/team-management/g6-pure";

import styles from "./supervisor-broker-profile.module.css";

export type BrokerPerformanceWindow = 7 | 30;
export type BrokerPerformanceTrend = "up" | "flat" | "down" | null;

/** Desempenho recebido de fora: a seção só desenha, não busca dado. */
export type BrokerPerformanceView = {
  window: BrokerPerformanceWindow;
  teamMedianAcceptSeconds?: number | null;
  items: Array<{ key: string; label: string; value: string; trend: BrokerPerformanceTrend; better: "up" | "down" }>;
};

export type BrokerDutyPresence = "confirmed" | "pending" | "absent" | "expired" | "not_required";

export type BrokerSituation = {
  /** undefined = this viewer does not see the roster (the row is hidden); null = no plantão today. */
  dutyToday?: { scheduleName: string; startsAt: string; endsAt: string; paused: boolean; presence: BrokerDutyPresence } | null;
  newLeads: number;
  nextTask: { title: string; dueAt: string | null; leadId: string; leadName: string } | null;
  /** WhatsApp conectado no sistema. null = fora do escopo do viewer (linha oculta). */
  whatsapp?: { connected: boolean; connectedAt: string | null } | null;
};

export type BrokerRecognitionView = { id: string; points: number; reason: string; occurredAt: string };

export type SupervisorBrokerProfileProps = {
  member: {
    userId: string;
    name: string;
    image: string | null;
    branchName: string | null;
    availabilityStatus: string;
    email?: string;
    phone?: string | null;
    brokerCode?: string | null;
    statusLabel?: string;
  };
  metrics: {
    portfolio: number;
    inService: number;
    withoutFirstContact: number;
    sales: number;
    overdueTasks: number;
    qualified?: number;
    lost?: number;
  };
  recentLeads: Array<{
    id: string;
    name: string;
    status: string;
    queueName: string | null;
    assignedAt: string | null;
    createdAt: string;
  }>;
  whatsappHref: string | null;
  relationshipHref: string;
  ranking: {
    medianAcceptSeconds: number | null;
    positions: string[];
    periodDays: number;
  } | null;
  notes: SupervisorNote[];
  joinedAt?: string;
  situation?: BrokerSituation;
  performance?: BrokerPerformanceView | null;
  metricTimeline?: MonthlyBrokerMetricPoint[] | null;
  recognitions?: BrokerRecognitionView[];
  weeklyAcceptances?: Array<{ date: string; label: string; accepted: number }>;
  managerProfile?: {
    temperature: { hot: number; warm: number; cold: number; unknown: number };
    quotes: { total: number; sent: number };
    sales: { total: number; cancelled: number };
    interactions: number;
    tasks: { completed: number; total: number };
    dutyDays: Array<{ date: string; scheduleName: string; startsAt: string; endsAt: string; state: string }>;
  };
  managementActions?: ReactNode;
  showSupervisorActions?: boolean;
};

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Disponível",
  on_duty: "Em plantão",
  paused: "Pausado",
  offline: "Offline",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  distributed: "Aguardando atendimento",
  in_contact: "Em atendimento",
  quote_sent: "Cotação enviada",
  negotiation: "Em negociação",
  documentation_pending: "Documentação pendente",
  under_analysis: "Em análise",
};

const DUTY_PRESENCE_LABELS: Record<BrokerDutyPresence, string> = {
  confirmed: "presença confirmada",
  pending: "aguardando confirmação",
  absent: "ausente",
  expired: "plantão encerrado",
  not_required: "sem confirmação",
};

const noteDateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const followUpDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const shortDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
const tenureDateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });
const brazilDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

function formatLeadDate(value: string | null, fallback: string) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

/** Today's date in São Paulo as YYYY-MM-DD: the lowest day a "Revisar em" may take. */
function todayKey() {
  return brazilDayFormat.format(new Date());
}

export function SupervisorBrokerProfile({
  member,
  metrics,
  recentLeads,
  whatsappHref,
  relationshipHref,
  ranking,
  notes: initialNotes,
  joinedAt,
  situation,
  performance,
  metricTimeline,
  recognitions = [],
  weeklyAcceptances = [],
  managerProfile,
  managementActions,
  showSupervisorActions = true,
}: SupervisorBrokerProfileProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [recognizeOpen, setRecognizeOpen] = useState(false);
  const [noteKind, setNoteKind] = useState<SupervisorNoteKind>("orientacao");
  const [noteBody, setNoteBody] = useState("");
  const [noteFollowUpDay, setNoteFollowUpDay] = useState("");
  const [noteFeedback, setNoteFeedback] = useState("");
  const [removing, startRemoving] = useTransition();
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const isOnline = member.availabilityStatus === "available" || member.availabilityStatus === "on_duty";
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  async function submitNote() {
    setNoteFeedback("");
    const body = noteBody;
    const result = await addSupervisorNoteAction({ brokerId: member.userId, kind: noteKind, body, ...(noteFollowUpDay ? { followUpDay: noteFollowUpDay } : {}) });
    if (!result.ok) { setNoteFeedback(result.message); throw new Error(result.message); }
    setNotes((current) => [result.note, ...current]);
    setNoteBody("");
    setNoteFollowUpDay("");
    setNoteFeedback("Nota salva.");
  }

  function removeFromTeam() {
    startRemoving(async () => {
      const result = await removeBrokerFromMyTeamAction(member.userId);
      if (result.ok) window.location.assign("/equipe/minha");
      else setNoteFeedback(result.message);
    });
  }

  const nextTaskOverdue = Boolean(situation?.nextTask?.dueAt && new Date(situation.nextTask.dueAt).getTime() < now);

  function changePerformanceWindow(window: BrokerPerformanceWindow) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("janela", String(window));
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <section className={`${styles.card} ${styles.header}`} aria-labelledby="broker-profile-title">
          <Avatar name={member.name} src={member.image ?? undefined} size="xl" status={isOnline ? "online" : "offline"} className={styles.avatar} />
          <div className={styles.identity}>
            <h1 id="broker-profile-title" className={styles.name}>{member.name}</h1>
            <p className={styles.branch}>{member.branchName ?? "Unidade não informada"}{member.brokerCode ? ` · Código ${member.brokerCode}` : ""}</p>
            {member.email ? <p className={styles.branch}>{member.email}</p> : null}
            {member.phone ? <p className={styles.branch}>{member.phone}</p> : null}
            {joinedAt ? <p className={styles.branch}>Na equipe desde {tenureDateFormat.format(new Date(joinedAt))}</p> : null}
            <Badge tone={isOnline ? "success" : "neutral"}>{AVAILABILITY_LABELS[member.availabilityStatus] ?? "Disponibilidade não informada"}</Badge>
            {member.statusLabel ? <Badge tone={member.statusLabel === "Ativo" ? "success" : "neutral"}>{member.statusLabel}</Badge> : null}
          </div>
          <div className={styles.actions}>
            {whatsappHref ? (
              <a className={styles.primaryAction} href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Chamar no WhatsApp (abre em nova aba)">
                Chamar no WhatsApp
              </a>
            ) : (
              <p className={styles.noPhone}>Telefone não cadastrado para WhatsApp.</p>
            )}
            <Link className={styles.secondaryAction} href={relationshipHref}>Mandar recado</Link>
          </div>
        </section>

        <div className={styles.columns}>
          <div className={styles.column}>
            <section className={`${styles.card} ${styles.situation}`} aria-labelledby="broker-situation-title">
              <div className={styles.sectionHeading}><h2 id="broker-situation-title">Situação atual</h2></div>
              <div className={styles.situationGrid}>
                <div className={styles.situationItem}><span>Carteira</span><strong>{numberFormat.format(metrics.portfolio)}</strong></div>
                <div className={styles.situationItem}><span>Leads ativos</span><strong>{numberFormat.format(metrics.inService)}</strong></div>
                <div className={styles.situationItem}><span>Novos</span><strong>{numberFormat.format(situation?.newLeads ?? 0)}</strong></div>
                <div className={styles.situationItem} data-alert={metrics.withoutFirstContact > 0}><span>Sem primeiro contato</span><strong>{numberFormat.format(metrics.withoutFirstContact)}</strong></div>
                <div className={styles.situationItem} data-alert={metrics.overdueTasks > 0}><span>Pendências</span><strong>{numberFormat.format(metrics.overdueTasks)}</strong><small>retornos vencidos</small></div>
              </div>
              <dl className={styles.situationRows}>
                {situation?.dutyToday !== undefined ? (
                  <div>
                    <dt>Plantão de hoje</dt>
                    <dd>
                      {situation.dutyToday
                        ? `${situation.dutyToday.scheduleName} · ${situation.dutyToday.startsAt} às ${situation.dutyToday.endsAt}${situation.dutyToday.paused ? " · pausado" : ` · ${DUTY_PRESENCE_LABELS[situation.dutyToday.presence]}`}`
                        : "Sem plantão hoje"}
                    </dd>
                  </div>
                ) : null}
                {situation?.whatsapp ? (
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>
                      {situation.whatsapp.connected ? (
                        <span>{`Conectado${situation.whatsapp.connectedAt ? ` desde ${shortDateFormat.format(new Date(situation.whatsapp.connectedAt))}` : ""}`}</span>
                      ) : (
                        <span className={styles.whatsappAlert} data-alert="true">WhatsApp não conectado. É obrigatório para receber leads do plantão a partir de 20/10.</span>
                      )}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Próxima ação</dt>
                  <dd>
                    {situation?.nextTask ? (
                      <>
                        <Link href={`/leads/${encodeURIComponent(situation.nextTask.leadId)}`}>{situation.nextTask.title}</Link>
                        <small data-alert={nextTaskOverdue}>
                          {situation.nextTask.dueAt
                            ? `${nextTaskOverdue ? "Vencida em" : "Vence em"} ${dateFormat.format(new Date(situation.nextTask.dueAt))}`
                            : "Sem prazo"} · {situation.nextTask.leadName}
                        </small>
                      </>
                    ) : "Nenhuma tarefa aberta"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={`${styles.card} ${styles.feedback}`} aria-labelledby="broker-profile-feedback">
              <div className={styles.sectionHeading}>
                <h2 id="broker-profile-feedback">Feedbacks</h2>
                <div className={styles.headingTools}>
                  <span>{numberFormat.format(notes.length)}</span>
                  <BottomSheet className="arc-venancor" open={noteSheetOpen} onOpenChange={setNoteSheetOpen} trigger={<Button variant="outline" size="sm" className={styles.pillButton}>+ Nova nota</Button>} title="Nova nota" description="Registre um feedback privado para este corretor." closeLabel="Fechar" detents={[0.62, 0.92]}>
                    <div className={styles.noteComposer}>
                      <SegmentedControl label="Tipo de feedback" value={noteKind} onValueChange={(value) => setNoteKind(value as SupervisorNoteKind)} options={SUPERVISOR_NOTE_KINDS.map((kind) => ({ value: kind, label: SUPERVISOR_NOTE_KIND_LABELS[kind] }))} />
                      <Textarea label="Mensagem" id="supervisor-note-body" value={noteBody} onChange={(event) => setNoteBody(event.currentTarget.value)} maxLength={1000} rows={3} placeholder="Escreva uma orientação, elogio ou alerta." aria-describedby="supervisor-note-count" />
                      <span id="supervisor-note-count" className={styles.noteCount}>{noteBody.length}/1000 caracteres</span>
                      <Input label="Revisar em (opcional)" id="supervisor-note-follow-up" type="date" min={todayKey()} value={noteFollowUpDay} onChange={(event) => setNoteFollowUpDay(event.currentTarget.value)} description="Lembrete para você voltar a este ponto." />
                      <ActionButton label="Salvar nota" pendingLabel="Salvando" successLabel="Nota salva" disabled={!noteBody.trim()} onAction={submitNote} onActionError={(error) => setNoteFeedback(error instanceof Error ? error.message : "Não foi possível salvar a nota.")} />
                      <p className={styles.noteFeedback} role="status" aria-live="polite">{noteFeedback}</p>
                    </div>
                  </BottomSheet>
                </div>
              </div>
              <SupervisorNoteHistory notes={notes} />
            </section>
          </div>

          <div className={styles.column}>
            <BrokerPerformanceSection
              performance={performance ?? null}
              onWindowChange={changePerformanceWindow}
              chart={weeklyAcceptances}
              teamMedianSeconds={performance?.teamMedianAcceptSeconds ?? null}
              positions={ranking?.positions ?? []}
            />

            {metricTimeline !== undefined && metricTimeline !== null ? <BrokerMetricTimeline points={metricTimeline} /> : null}

            <section className={`${styles.card} ${styles.recognitions}`} aria-labelledby="broker-recognitions-title">
              <div className={styles.sectionHeading}><h2 id="broker-recognitions-title">Reconhecimentos recebidos</h2><span>{recognitions.length || "·"}</span></div>
              {recognitions.length ? (
                <ul className={styles.recognitionList}>
                  {recognitions.map((item) => (
                    <li key={item.id}>
                      <strong>+{numberFormat.format(item.points)} pts</strong>
                      <span>{item.reason}</span>
                      <time dateTime={item.occurredAt}>{noteDateFormat.format(new Date(item.occurredAt))}</time>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="Nenhum reconhecimento recente" description="Os reconhecimentos com pontos aparecem aqui." />}
            </section>

          </div>
        </div>

        <section className={`${styles.card} ${styles.leads}`} aria-labelledby="broker-profile-leads">
          <div className={styles.sectionHeading}>
            <h2 id="broker-profile-leads">Leads ativos recentes</h2>
            <span>{numberFormat.format(recentLeads.length)}</span>
          </div>
          {recentLeads.length ? (
            <ul className={styles.leadList}>
              {recentLeads.map((lead) => {
                const updated = formatLeadDate(lead.assignedAt, lead.createdAt);
                return (
                  <li key={lead.id}>
                    <Link className={styles.lead} href={`/leads/${lead.id}`}>
                      <span className={styles.leadInitials} aria-hidden="true">
                        {lead.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("pt-BR") ?? "").join("")}
                      </span>
                      <span className={styles.leadMain}>
                        <strong>{lead.name}</strong>
                        <span>{[LEAD_STATUS_LABELS[lead.status] ?? "Em andamento", lead.queueName, updated].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className={styles.leadArrow} aria-hidden="true">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState title="Nenhum lead ativo recente" description="Os leads em andamento deste corretor aparecem aqui." />}
        </section>

        {managerProfile ? <>
          <section className={styles.card} aria-labelledby="broker-temperatures-title"><div className={styles.sectionHeading}><h2 id="broker-temperatures-title">Temperatura dos leads</h2></div><div className={styles.todayGrid}>{[["Quentes", managerProfile.temperature.hot], ["Mornos", managerProfile.temperature.warm], ["Frios", managerProfile.temperature.cold], ["Sem classificação", managerProfile.temperature.unknown]].map(([label, value]) => <div className={styles.todayMetric} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
          <section className={styles.card} aria-labelledby="broker-commercial-result-title"><div className={styles.sectionHeading}><h2 id="broker-commercial-result-title">Resultado comercial</h2></div><div className={styles.weekFacts}><p><span>Cotações criadas</span><strong>{managerProfile.quotes.total} ({managerProfile.quotes.sent} enviadas)</strong></p><p><span>Vendas registradas</span><strong>{managerProfile.sales.total} ({managerProfile.sales.cancelled} canceladas)</strong></p><p><span>Tarefas concluídas</span><strong>{managerProfile.tasks.completed} de {managerProfile.tasks.total}</strong></p><p><span>Interações</span><strong>{managerProfile.interactions}</strong></p></div></section>
          <section className={styles.card} aria-labelledby="broker-duty-days-title"><div className={styles.sectionHeading}><h2 id="broker-duty-days-title">Dias de plantão</h2><span>Somente leitura</span></div>{managerProfile.dutyDays.length ? <ul className={styles.attentionList}>{managerProfile.dutyDays.map((day) => <li key={`${day.date}-${day.scheduleName}`}><span><strong>{day.scheduleName}</strong><span>{day.date} · {day.startsAt} às {day.endsAt}</span></span></li>)}</ul> : <EmptyState title="Sem plantões no período" description="Os dias de plantão futuros e recentes aparecem aqui." />}</section>
        </> : null}

        {showSupervisorActions ? <BottomSheet className="arc-venancor" trigger={<Button variant="outline">Mais ações</Button>} title={`Ações para ${member.name}`} description="Escolha como quer apoiar este corretor." closeLabel="Fechar" detents={[0.4, 0.72]}>
          <div className={styles.memberActions}><Link className={styles.secondaryAction} href={relationshipHref}>Mandar recado</Link><button type="button" className={styles.secondaryAction} onClick={() => setRecognizeOpen(true)}>Reconhecer com pontos</button><Button variant="destructive" disabled={removing} loading={removing} onClick={removeFromTeam}>Remover da equipe</Button></div>
          <RecognizeSheet brokerId={member.userId} brokerName={member.name} open={recognizeOpen} onOpenChange={setRecognizeOpen} onRecognize={recognizeBrokerAction} />
        </BottomSheet> : managementActions ?? null}
      </div>
    </div>
  );
}

const PERFORMANCE_WINDOWS: BrokerPerformanceWindow[] = [7, 30];

function TrendMark({ trend, better }: { trend: BrokerPerformanceTrend; better: "up" | "down" }) {
  if (!trend) return null;
  if (trend === "flat") return <span className={styles.trendFlat} aria-label="Estável">→</span>;
  const improved = trend === better;
  return (
    <span className={improved ? styles.trendGood : styles.trendBad} aria-label={improved ? "Melhorou" : "Piorou"}>
      {trend === "up" ? "↑" : "↓"}
    </span>
  );
}

/**
 * Desempenho do corretor. Componente puro: recebe a janela, os itens, o gráfico e a posição prontos.
 * O seletor 7/30 só troca a janela quando o pai passa `onWindowChange`; sem ele, a outra janela fica desabilitada.
 */
const timelineMonthFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const timelinePercentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function BrokerMetricTimeline({ points }: { points: MonthlyBrokerMetricPoint[] }) {
  const measured = points.filter((point) => point.conversionRate !== null);
  const coordinates = measured.map((point, index) => ({
    month: point.month,
    x: measured.length < 2 ? 150 : 12 + index * (276 / (measured.length - 1)),
    y: 72 - Math.max(0, Math.min(100, point.conversionRate ?? 0)) * 0.6,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <section className={`${styles.card} ${styles.metricTimeline}`} aria-labelledby="broker-metric-timeline-title">
      <div className={styles.sectionHeading}><h2 id="broker-metric-timeline-title">Evolução mês a mês</h2><span>Conversão canônica</span></div>
      {points.length ? <>
        {coordinates.length > 1 ? <svg className={styles.metricTimelineChart} viewBox="0 0 300 84" role="img" aria-label="Evolução mensal da taxa canônica de conversão">
          <line x1="8" y1="72" x2="292" y2="72" stroke="currentColor" opacity="0.16" />
          <polyline points={line} fill="none" stroke="var(--chat-action)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {coordinates.map((point) => <circle key={point.month} cx={point.x} cy={point.y} r="4" fill="var(--chat-action)" />)}
        </svg> : null}
        <ol className={styles.metricTimelineList}>
          {points.map((point) => <li key={point.month}>
            <strong>{timelineMonthFormat.format(new Date(`${point.month}-01T12:00:00-03:00`))}</strong>
            <span>{point.conversionRate === null ? "Sem dado" : `${timelinePercentFormat.format(point.conversionRate)}%`}</span>
            <small>{point.leadsConverted ?? 0} de {point.leadsReceived ?? 0} leads</small>
          </li>)}
        </ol>
      </> : <EmptyState title="Histórico em formação" description="Os pontos mensais aparecem depois que os snapshots diários forem gerados." />}
    </section>
  );
}

export function BrokerPerformanceSection({
  performance,
  onWindowChange,
  chart = [],
  teamMedianSeconds = null,
  positions = [],
}: {
  performance: BrokerPerformanceView | null;
  onWindowChange?: (window: BrokerPerformanceWindow) => void;
  chart?: Array<{ date: string; label: string; accepted: number }>;
  teamMedianSeconds?: number | null;
  positions?: string[];
}) {
  const hasChart = chart.some((day) => day.accepted > 0);
  return (
    <section className={`${styles.card} ${styles.performance}`} aria-labelledby="broker-performance-title">
      <div className={styles.performanceHead}>
        <h2 id="broker-performance-title">Desempenho</h2>
        <div className={styles.windowSwitch} role="group" aria-label="Período do desempenho">
          {PERFORMANCE_WINDOWS.map((window) => {
            const active = performance?.window === window;
            const disabled = !active && !onWindowChange;
            return (
              <button
                key={window}
                type="button"
                className={styles.windowButton}
                aria-pressed={active}
                disabled={disabled}
                title={disabled ? "Período alternativo indisponível" : undefined}
                onClick={() => onWindowChange?.(window)}
              >
                {window} dias
              </button>
            );
          })}
        </div>
      </div>
      {performance && performance.items.length ? (
        <>
          <ul className={styles.performanceItems}>
            {performance.items.map((item) => (
              <li key={item.key}>
                <span>{item.label}</span>
                <strong>{item.value} <TrendMark trend={item.trend} better={item.better} /></strong>
              </li>
            ))}
          </ul>
          {hasChart ? (
            <div className={styles.performanceChart} role="img" aria-label="Aceites nos últimos sete dias">
              {chart.map((day) => (
                <div className={styles.dayBar} key={day.date}>
                  <strong>{day.accepted}</strong>
                  <span style={{ "--bar-height": `${Math.max(6, Math.min(100, day.accepted * 18))}%` } as React.CSSProperties} />
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.performanceFoot}>
            <p><span>Média da equipe</span><strong>{teamMedianSeconds === null ? "Ainda sem comparação" : formatDuration(teamMedianSeconds)}</strong></p>
            {positions.length ? <ul className={styles.chips}>{positions.map((position) => <li key={position}>{position}</li>)}</ul> : null}
          </div>
        </>
      ) : <EmptyState title="Sem dados de desempenho" description="Os números do período aparecem aqui assim que houver atividade." />}
    </section>
  );
}

export function SupervisorNoteHistory({ notes }: { notes: SupervisorNote[] }) {
  const [now] = useState(() => Date.now());
  if (!notes.length) return <EmptyState title="Sem feedbacks registrados" description="As notas privadas desta equipe aparecem aqui." />;

  return (
    <ol className={styles.noteList}>
      {notes.map((note) => {
        const overdue = note.followUpAt !== null && new Date(note.followUpAt).getTime() < now;
        return (
          <li key={note.id} className={styles.noteItem}>
            <div className={styles.noteMeta}>
              <strong>{SUPERVISOR_NOTE_KIND_LABELS[note.kind]}</strong>
              <time dateTime={note.createdAt}>{noteDateFormat.format(new Date(note.createdAt))}</time>
            </div>
            <p>{note.body}</p>
            {note.followUpAt ? (
              <p className={styles.noteFollowUp} data-overdue={overdue}>
                Revisar em {followUpDateFormat.format(new Date(note.followUpAt))}{overdue ? " · vencido" : ""}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
