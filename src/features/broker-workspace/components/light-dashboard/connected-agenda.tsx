"use client";

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/motion-tokens";
import { ArrowsClockwise, CalendarBlank, ChevronRightIcon, ListChecks, Phone } from "@/components/huge-icons";
import { LiteSuccess } from "@/components/lite/motion/success";
import {
  AGENDA_KIND_LABELS,
  agendaDestination,
  formatAgendaEntryWhen,
  groupAgendaEntries,
  type AgendaDutyLine,
  type AgendaEntry,
  type AgendaEntryKind,
} from "@/features/broker-workspace/agenda-connected";

import { AgendaNotice } from "./agenda-notice";
import { useAgendaAction } from "./use-agenda-action";
import { useMinuteClock } from "./use-minute-clock";

const KIND_ICONS: Record<AgendaEntryKind, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  retorno: Phone,
  tarefa: ListChecks,
  renovacao: ArrowsClockwise,
};

const RESCHEDULE_OPTIONS = [
  { value: "today", label: "Hoje às 18h" },
  { value: "tomorrow", label: "Amanhã de manhã" },
  { value: "in_2_days", label: "Em 2 dias" },
  { value: "in_3_days", label: "Em 3 dias" },
] as const;

/**
 * Agenda conectada (Etapa 6): retornos, tarefas e renovações agrupados por dia, cada um abrindo o lead
 * ou o perfil do cliente. As ações chamam as mesmas actions da Agenda anterior (mesmas checagens e auditoria).
 */
export function ConnectedAgenda({ entries, duty, generatedAt }: {
  entries: AgendaEntry[];
  duty: AgendaDutyLine | null;
  /** Hora do servidor, usada até o relógio do navegador montar (evita grupos diferentes na hidratação). */
  generatedAt: string;
}) {
  const clock = useMinuteClock();
  const reduceMotion = useReducedMotion();
  const now = useMemo(() => clock ?? new Date(generatedAt), [clock, generatedAt]);
  const groups = useMemo(() => groupAgendaEntries(entries, now), [entries, now]);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const { busyId, done, notice, execute: run, retry } = useAgendaAction();

  async function execute(id: string, name: Parameters<typeof run>[1], payload: Record<string, unknown>) {
    if (await run(id, name, payload)) setReschedulingId(null);
  }

  const enter = reduceMotion ? false : { opacity: 0, y: motionTokens.distance.xs };
  const exit = reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: motionTokens.duration.exit } };

  return (
    <div className="flex flex-col gap-5">
      {duty ? (
        <Link
          href="/plantoes"
          className="flex min-h-16 items-center gap-3 rounded-3xl bg-(--chat-action-soft) px-4 py-3 text-(--foreground) shadow-(--shadow-resting) transition-colors hover:bg-(--surface-muted) focus-visible:outline-2 focus-visible:outline-(--chat-action)"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--surface) text-(--chat-action-text)">
            <CalendarBlank className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-(--text-secondary)">{duty.state === "em_andamento" ? "Seu plantão agora" : "Seu plantão hoje"}</span>
            <span className="block truncate text-sm font-medium">{duty.title}</span>
            <span className="block truncate text-sm text-(--text-secondary)">{duty.detail}</span>
          </span>
          <span className="hidden shrink-0 text-sm font-medium text-(--chat-action-text) sm:inline">Ver plantões</span>
          <ChevronRightIcon className="size-4 shrink-0 text-(--chat-action-text) sm:hidden" aria-hidden />
        </Link>
      ) : null}

      <AgendaNotice notice={notice} busyId={busyId} onUndo={(name, payload) => void execute("undo", name, payload)} onRetry={retry} />

      {groups.length === 0 ? (
        <section className="grid justify-items-start gap-3 rounded-3xl bg-(--surface-muted) p-5 shadow-(--shadow-resting)" aria-label="Agenda vazia">
          <p className="text-base font-semibold text-(--foreground)">Nada agendado por enquanto</p>
          <p className="text-sm text-(--text-secondary)">Retornos, tarefas e renovações com prazo aparecem aqui, separados por dia.</p>
          <Link href="/leads?tab=minha-fila" className="inline-flex min-h-11 items-center text-sm font-medium text-(--chat-action-text)">Ver meus leads</Link>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`agenda-group-${group.key}`} className="grid gap-2">
            <h2 id={`agenda-group-${group.key}`} className="flex items-center gap-2 text-base font-semibold text-(--foreground)">
              {group.label}
              <span className="text-sm font-normal tabular-nums text-(--text-secondary)">{group.entries.length}</span>
            </h2>
            <ul className="grid overflow-hidden rounded-3xl bg-(--surface-muted) shadow-(--shadow-resting)">
              <AnimatePresence initial={false}>
                {group.entries.map((entry, index) => {
                  const destination = agendaDestination(entry);
                  const Icon = KIND_ICONS[entry.kind];
                  const when = formatAgendaEntryWhen(entry.dueAt ? new Date(entry.dueAt) : null, group.key, now);
                  const busy = busyId === entry.id;
                  return (
                    <motion.li
                      key={entry.id}
                      layout={reduceMotion ? false : "position"}
                      initial={enter}
                      animate={{ opacity: 1, y: 0, transition: { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter], delay: Math.min(index, motionTokens.stagger.max - 1) * motionTokens.stagger.item } }}
                      exit={exit}
                      className="grid gap-2 border-t border-(--border-subtle) px-3 py-3 first:border-t-0 sm:px-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Link
                          href={destination.href}
                          aria-label={`${entry.title}, ${destination.label}`}
                          className="group flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-(--chat-action)"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--chat-action-soft) text-(--chat-action-text)">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-medium break-words text-(--foreground)">{entry.title}</span>
                            <span className="block truncate text-sm text-(--text-secondary)">{AGENDA_KIND_LABELS[entry.kind]} · {entry.leadName}</span>
                          </span>
                          <ChevronRightIcon className="hidden size-4 shrink-0 text-(--text-secondary) transition-transform motion-safe:group-hover:translate-x-0.5 sm:block" aria-hidden />
                        </Link>
                        <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                          {when ? <span className="text-sm tabular-nums text-(--text-secondary)">{when}</span> : null}
                          {group.key === "atrasados" ? <Badge tone="warning" size="sm">Atrasado</Badge> : entry.priority === "urgent" ? <Badge tone="danger" size="sm">Urgente</Badge> : null}
                        </span>
                      </div>
                      {done?.id === entry.id ? (
                        <div className="flex min-h-9 items-center text-sm font-medium text-(--success) sm:pl-[3.25rem]">
                          <LiteSuccess label={done.label} />
                        </div>
                      ) : (
                      <div className="flex flex-wrap items-center gap-2 sm:pl-[3.25rem]">
                        <Button size="sm" variant="secondary" loading={busy} disabled={busyId !== null} onClick={() => execute(entry.id, "lead.completeReturn", { taskId: entry.id })}>Concluir</Button>
                        <Button size="sm" variant="ghost" disabled={busyId !== null} aria-expanded={reschedulingId === entry.id} onClick={() => setReschedulingId(reschedulingId === entry.id ? null : entry.id)}>Reagendar</Button>
                        <Button size="sm" variant="ghost" disabled={busyId !== null} onClick={() => execute(entry.id, "lead.cancelReturn", { taskId: entry.id, leadName: entry.leadName })}>Cancelar</Button>
                        {destination.secondary ? (
                          <Link href={destination.secondary.href} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-(--chat-action-text)">
                            {destination.secondary.label}
                          </Link>
                        ) : null}
                      </div>
                      )}
                      {reschedulingId === entry.id && done?.id !== entry.id ? (
                        <div className="flex flex-wrap gap-2 sm:pl-[3.25rem]" role="group" aria-label={`Novo prazo para ${entry.leadName}`}>
                          {RESCHEDULE_OPTIONS.map((option) => (
                            <Button key={option.value} size="sm" variant="secondary" loading={busy} disabled={busyId !== null} onClick={() => execute(entry.id, "lead.scheduleReturn", { leadId: entry.leadId, when: option.value, taskId: entry.id })}>
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** Falha de leitura: não afirma que a agenda está vazia, só oferece tentar de novo. */
export function ConnectedAgendaError() {
  const router = useRouter();
  return (
    <section role="alert" className="grid justify-items-start gap-3 rounded-3xl bg-(--surface-muted) p-5 shadow-(--shadow-resting)">
      <p className="text-base font-semibold text-(--foreground)">Não consegui carregar sua agenda</p>
      <p className="text-sm text-(--text-secondary)">Seus retornos continuam salvos. Tente de novo em alguns segundos.</p>
      <Button size="sm" variant="secondary" onClick={() => router.refresh()}>Tentar de novo</Button>
    </section>
  );
}
