"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDuration } from "@/features/engagement/ranking";
import { addSupervisorNoteAction } from "@/features/supervisor-workspace/notes-actions";
import { SUPERVISOR_NOTE_KINDS, type SupervisorNote, type SupervisorNoteKind } from "@/features/supervisor-workspace/notes-types";

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
}: SupervisorBrokerProfileProps) {
  const reduce = useReducedMotion();
  const [notes, setNotes] = useState(initialNotes);
  const [noteKind, setNoteKind] = useState<SupervisorNoteKind>("orientacao");
  const [noteBody, setNoteBody] = useState("");
  const [noteFeedback, setNoteFeedback] = useState("");
  const [isSavingNote, startSavingNote] = useTransition();
  const ease = [0.16, 1, 0.3, 1] as const;
  const stats = [
    { label: "Carteira", value: metrics.portfolio },
    { label: "Em atendimento", value: metrics.inService },
    { label: "Sem primeiro contato", value: metrics.withoutFirstContact, alert: metrics.withoutFirstContact > 0 },
    { label: "Vendas", value: metrics.sales },
    { label: "Tarefas vencidas", value: metrics.overdueTasks, alert: metrics.overdueTasks > 0 },
  ];

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteFeedback("");
    const body = noteBody;
    startSavingNote(async () => {
      const result = await addSupervisorNoteAction({ brokerId: member.userId, kind: noteKind, body });
      if (!result.ok) {
        setNoteFeedback(result.message);
        return;
      }
      setNotes((current) => [result.note, ...current]);
      setNoteBody("");
      setNoteFeedback("Feedback salvo.");
    });
  }

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <motion.section
          className={styles.header}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease }}
          aria-labelledby="broker-profile-title"
        >
          <UserAvatar
            seed={member.userId}
            name={member.name}
            photoUrl={member.image}
            size="lg"
            className={styles.avatar}
          />
          <div className={styles.identity}>
            <h1 id="broker-profile-title" className={styles.name}>{member.name}</h1>
            <p className={styles.branch}>{member.branchName ?? "Unidade não informada"}</p>
            <p className={styles.status} data-status={member.availabilityStatus}>
              <span className={styles.statusDot} aria-hidden="true" />
              {AVAILABILITY_LABELS[member.availabilityStatus] ?? "Disponibilidade não informada"}
            </p>
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
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className={`${styles.stat} ${stat.alert ? styles.statAlert : ""}`}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : 0.04 * index, ease }}
            >
              <span className={styles.statLabel}>{stat.label}</span>
              <strong className={styles.statValue}>{numberFormat.format(stat.value)}</strong>
            </motion.div>
          ))}
        </section>

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
                    transition={{ duration: 0.2, delay: reduce ? 0 : Math.min(index, 4) * 0.04, ease }}
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
          ) : (
            <p className={styles.empty}>Nenhum lead ativo recente.</p>
          )}
        </section>

        <section className={styles.feedback} aria-labelledby="broker-profile-feedback">
          <div className={styles.sectionHeading}>
            <h2 id="broker-profile-feedback">Feedbacks</h2>
            <span>{numberFormat.format(notes.length)}</span>
          </div>
          <form className={styles.noteForm} onSubmit={submitNote}>
            <fieldset className={styles.noteKinds} disabled={isSavingNote}>
              <legend>Tipo de feedback</legend>
              {SUPERVISOR_NOTE_KINDS.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={styles.noteKind}
                  data-active={noteKind === kind}
                  aria-pressed={noteKind === kind}
                  onClick={() => setNoteKind(kind)}
                >
                  {NOTE_KIND_LABELS[kind]}
                </Button>
              ))}
            </fieldset>
            <label className={styles.noteLabel} htmlFor="supervisor-note-body">Mensagem</label>
            <Textarea
              id="supervisor-note-body"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              maxLength={1000}
              required
              placeholder="Registre uma orientação, elogio ou alerta."
              disabled={isSavingNote}
              aria-describedby="supervisor-note-count supervisor-note-feedback"
            />
            <div className={styles.noteFormFooter}>
              <span id="supervisor-note-count">{noteBody.length}/1000</span>
              <Button type="submit" size="sm" disabled={isSavingNote || !noteBody.trim()} loading={isSavingNote}>
                Salvar
              </Button>
            </div>
            <p id="supervisor-note-feedback" className={styles.noteFeedback} role="status" aria-live="polite">{noteFeedback}</p>
          </form>
          <SupervisorNoteHistory notes={notes} />
        </section>
      </div>
    </div>
  );
}

export function SupervisorNoteHistory({ notes }: { notes: SupervisorNote[] }) {
  if (!notes.length) return <p className={styles.empty}>Sem feedbacks registrados.</p>;

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
