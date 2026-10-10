"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ActionButton } from "@/components/arc/action-button/action-button";
import { Textarea } from "@/components/arc/textarea/textarea";
import { formatDuration } from "@/features/engagement/ranking";
import { addSupervisorNoteAction } from "@/features/supervisor-workspace/notes-actions";
import { SUPERVISOR_NOTE_KINDS, type SupervisorNote, type SupervisorNoteKind } from "@/features/supervisor-workspace/notes-types";
import { removeBrokerFromMyTeamAction } from "@/features/supervisor-workspace/my-team-actions";

import styles from "./supervisor-broker-profile.module.css";

export type SupervisorBrokerProfileProps = {
  member: {
    userId: string;
    name: string;
    image: string | null;
    branchName: string | null;
    availabilityStatus: string;
  };
  metrics: {
    portfolio: number;
    inService: number;
    withoutFirstContact: number;
    sales: number;
    overdueTasks: number;
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
  pulse?: {
    today: { received: number; accepted: number; inService: number; late: number };
    week: Array<{ date: string; label: string; accepted: number }>;
    medianAcceptSeconds: number | null; teamMedianSeconds: number | null; onTimeContactRate: number | null;
    funnel: Array<{ status: string; label: string; total: number }>;
    attention: Array<{ id: string; name: string; status: string; assignedAt: string | null; stageEnteredAt: string | null; firstContactAt: string | null }>;
  };
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
const NOTE_KIND_LABELS: Record<SupervisorNoteKind, string> = {
  orientacao: "Orientação",
  elogio: "Elogio",
  alerta: "Alerta",
};
const noteDateFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatLeadDate(value: string | null, fallback: string) {
  const date = new Date(value ?? fallback);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
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
  pulse,
}: SupervisorBrokerProfileProps) {
  const reduce = useReducedMotion();
  const [notes, setNotes] = useState(initialNotes);
  const [noteKind, setNoteKind] = useState<SupervisorNoteKind>("orientacao");
  const [noteBody, setNoteBody] = useState("");
  const [noteFeedback, setNoteFeedback] = useState("");
  const [removing, startRemoving] = useTransition();
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);

  async function submitNote() {
    setNoteFeedback("");
    const body = noteBody;
    const result = await addSupervisorNoteAction({ brokerId: member.userId, kind: noteKind, body });
    if (!result.ok) { setNoteFeedback(result.message); throw new Error(result.message); }
    setNotes((current) => [result.note, ...current]);
    setNoteBody("");
    setNoteFeedback("Nota salva.");
  }

  function removeFromTeam() {
    startRemoving(async () => {
      const result = await removeBrokerFromMyTeamAction(member.userId);
      if (result.ok) window.location.assign("/equipe/minha");
      else setNoteFeedback(result.message);
    });
  }

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <motion.section
          className={styles.header}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
          aria-labelledby="broker-profile-title"
        >
          <Avatar name={member.name} src={member.image ?? undefined} size="xl" status={member.availabilityStatus === "available" || member.availabilityStatus === "on_duty" ? "online" : "offline"} className={styles.avatar} />
          <div className={styles.identity}>
            <h1 id="broker-profile-title" className={styles.name}>{member.name}</h1>
            <p className={styles.branch}>{member.branchName ?? "Unidade não informada"}</p>
            <Badge tone={member.availabilityStatus === "available" || member.availabilityStatus === "on_duty" ? "success" : "neutral"}>{AVAILABILITY_LABELS[member.availabilityStatus] ?? "Disponibilidade não informada"}</Badge>
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
        </motion.section>

        <section className={styles.stats} aria-label="Resumo do corretor">
          {metrics.portfolio > 0 ? <MetricCard label="Carteira" value={metrics.portfolio} context="leads no total" /> : null}
          {metrics.inService > 0 ? <MetricCard label="Em atendimento" value={metrics.inService} context="leads em andamento" /> : null}
          <div className={styles.compactMetrics}>{[
            ["Sem primeiro contato", metrics.withoutFirstContact], ["Vendas", metrics.sales], ["Tarefas vencidas", metrics.overdueTasks],
          ].map(([label, value]) => <p key={label}><span>{label}</span><strong data-alert={label === "Tarefas vencidas" && Number(value) > 0}>{Number(value) > 0 ? numberFormat.format(Number(value)) : "·"}</strong></p>)}</div>
        </section>

        {joinedAt ? <p className={styles.teamTenure}>Na equipe desde {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(joinedAt))}</p> : null}
        {ranking ? (
          <section className={styles.ranking} aria-label="Desempenho na equipe">
            <div>
              <p className={styles.rankingLabel}>Tempo mediano para aceitar</p>
              <strong className={styles.rankingValue}>{formatDuration(ranking.medianAcceptSeconds)}</strong>
              <p className={styles.rankingHint}>Últimos {ranking.periodDays} dias</p>
            </div>
            {ranking.positions.length ? (
              <div className={styles.positions}>
                <p className={styles.rankingLabel}>Posições na equipe</p>
                <ul>
                  {ranking.positions.map((position) => <li key={position}>{position}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {pulse ? <>
          <section className={styles.pulseSection} aria-labelledby="member-today-title">
            <div className={styles.sectionHeading}><h2 id="member-today-title">Hoje</h2></div>
            <div className={styles.todayGrid}>{[
              ["Recebidos", pulse.today.received], ["Aceitos", pulse.today.accepted], ["Em atendimento", pulse.today.inService], ["Atrasados", pulse.today.late],
            ].map(([label, value]) => <div key={label} className={Number(value) > 0 && label === "Atrasados" ? styles.todayAlert : styles.todayMetric}><span>{label}</span><strong>{value}</strong></div>)}</div>
          </section>
          <section className={styles.pulseSection} aria-labelledby="member-week-title">
            <div className={styles.sectionHeading}><h2 id="member-week-title">Semana</h2></div>
            {pulse.week.some((day) => day.accepted > 0) ? <div className={styles.weekChart} role="img" aria-label="Aceites nos últimos sete dias">{pulse.week.map((day) => <div className={styles.dayBar} key={day.date}><strong>{day.accepted}</strong><span style={{ "--bar-height": `${Math.max(6, Math.min(100, day.accepted * 18))}%` } as React.CSSProperties} /><small>{day.label}</small></div>)}</div> : <EmptyState title="Ainda sem aceites nesta semana" description="Os aceites de novos leads aparecem aqui ao longo da semana." />}
            <div className={styles.weekFacts}><p><span>Tempo mediano para aceitar</span><strong>{pulse.medianAcceptSeconds === null ? "Ainda sem aceites nesta semana" : formatDuration(pulse.medianAcceptSeconds)}</strong></p><p><span>Média da equipe</span><strong>{pulse.teamMedianSeconds === null ? "Ainda sem comparação" : formatDuration(pulse.teamMedianSeconds)}</strong></p><p><span>Primeiro contato no prazo</span><strong>{pulse.onTimeContactRate === null ? "Ainda sem contatos na semana" : `${pulse.onTimeContactRate}%`}</strong></p></div>
          </section>
          <section className={styles.pulseSection} aria-labelledby="member-funnel-title"><div className={styles.sectionHeading}><h2 id="member-funnel-title">Funil pessoal</h2></div><ul className={styles.personalFunnel}>{pulse.funnel.map((item) => { const max = Math.max(1, ...pulse.funnel.map((step) => step.total)); return <li key={item.status}><span>{item.label}</span><span className={styles.funnelTrack}><i style={{ width: `${Math.round(item.total / max * 100)}%` }} /></span><strong>{item.total}</strong></li>; })}</ul></section>
          <section className={styles.pulseSection} aria-labelledby="member-attention-title"><div className={styles.sectionHeading}><h2 id="member-attention-title">Atenção agora</h2><span>{pulse.attention.length || "·"}</span></div>{pulse.attention.length ? <ul className={styles.attentionList}>{pulse.attention.map((lead) => <li key={lead.id}><Link href={`/leads/${encodeURIComponent(lead.id)}`}><strong>{lead.name}</strong><span>{lead.firstContactAt ? "Sem avanço há mais de 3 dias" : "Sem primeiro contato"}</span></Link><Link className={styles.handoffLink} href={`/equipe/repassar?lead=${encodeURIComponent(lead.id)}`}>Repassar</Link></li>)}</ul> : <EmptyState title="Nenhum lead precisa de atenção" description="Os leads parados ou atrasados vão aparecer aqui." />}</section>
        </> : null}

        <section className={styles.leads} aria-labelledby="broker-profile-leads">
          <div className={styles.sectionHeading}>
            <h2 id="broker-profile-leads">Leads ativos recentes</h2>
            <span>{numberFormat.format(recentLeads.length)}</span>
          </div>
          {recentLeads.length ? (
            <ul className={styles.leadList}>
              {recentLeads.map((lead, index) => {
                const updated = formatLeadDate(lead.assignedAt, lead.createdAt);
                return (
                  <motion.li
                    key={lead.id}
                    initial={reduce ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduce ? { duration: motionTokens.duration.instant } : { duration: motionTokens.duration.fast, delay: Math.min(index, 4) * motionTokens.stagger.item, ease: [...motionTokens.ease.enter] }}
                  >
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
                  </motion.li>
                );
              })}
            </ul>
          ) : <EmptyState title="Nenhum lead ativo recente" description="Os leads em andamento deste corretor aparecem aqui." />}
        </section>

        <section className={styles.feedback} aria-labelledby="broker-profile-feedback">
          <div className={styles.sectionHeading}>
            <h2 id="broker-profile-feedback">Feedbacks</h2>
            <span>{numberFormat.format(notes.length)}</span>
          </div>
          <BottomSheet className="arc-venancor" open={noteSheetOpen} onOpenChange={setNoteSheetOpen} trigger={<Button variant="outline">Nova nota</Button>} title="Nova nota" description="Registre um feedback privado para este corretor." closeLabel="Fechar" detents={[0.52, 0.86]}>
            <div className={styles.noteComposer}>
              <SegmentedControl label="Tipo de feedback" value={noteKind} onValueChange={(value) => setNoteKind(value as SupervisorNoteKind)} options={SUPERVISOR_NOTE_KINDS.map((kind) => ({ value: kind, label: NOTE_KIND_LABELS[kind] }))} />
              <Textarea label="Mensagem" id="supervisor-note-body" value={noteBody} onChange={(event) => setNoteBody(event.currentTarget.value)} maxLength={1000} rows={3} placeholder="Escreva uma orientação, elogio ou alerta." aria-describedby="supervisor-note-count" />
              <span id="supervisor-note-count" className={styles.noteCount}>{noteBody.length}/1000 caracteres</span>
              <ActionButton label="Salvar nota" pendingLabel="Salvando" successLabel="Nota salva" disabled={!noteBody.trim()} onAction={submitNote} onActionError={(error) => setNoteFeedback(error instanceof Error ? error.message : "Não foi possível salvar a nota.")} />
              <p className={styles.noteFeedback} role="status" aria-live="polite">{noteFeedback}</p>
            </div>
          </BottomSheet>
          <SupervisorNoteHistory notes={notes} />
        </section>

        <BottomSheet className="arc-venancor" trigger={<Button variant="outline">Mais ações</Button>} title={`Ações para ${member.name}`} description="Escolha como quer apoiar este corretor." closeLabel="Fechar" detents={[0.4, 0.72]}>
          <div className={styles.memberActions}><Link className={styles.secondaryAction} href={relationshipHref}>Mandar recado</Link><Link className={styles.secondaryAction} href={`${relationshipHref}?kind=recognition`}>Reconhecer</Link><Button variant="destructive" disabled={removing} loading={removing} onClick={removeFromTeam}>Remover da equipe</Button></div>
        </BottomSheet>
      </div>
    </div>
  );
}

export function SupervisorNoteHistory({ notes }: { notes: SupervisorNote[] }) {
  if (!notes.length) return <EmptyState title="Sem feedbacks registrados" description="As notas privadas desta equipe aparecem aqui." />;

  return (
    <ol className={styles.noteList}>
      {notes.map((note) => (
        <li key={note.id} className={styles.noteItem}>
          <div className={styles.noteMeta}>
            <strong>{NOTE_KIND_LABELS[note.kind]}</strong>
            <time dateTime={note.createdAt}>{noteDateFormat.format(new Date(note.createdAt))}</time>
          </div>
          <p>{note.body}</p>
        </li>
      ))}
    </ol>
  );
}
