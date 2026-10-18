"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/arc/badge/badge";
import type { ChatServerActionName } from "@/components/chat/types";
import { runChatServerAction, type ChatServerActionResult } from "@/features/broker-workspace/chat/chat-actions";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { formatAgendaWhen } from "./format";
import { useMinuteClock } from "./use-minute-clock";

const MAX_ITEMS = 4;

/** Short home preview or the complete interactive agenda page. */
export function Agenda({ items, maxItems = MAX_ITEMS, interactive = false, heading = "Agenda" }: {
  items: BrokerWorkspaceData["agenda"];
  maxItems?: number | null;
  interactive?: boolean;
  heading?: string;
}) {
  type UndoAction = NonNullable<ChatServerActionResult["undo"]>["action"];
  const router = useRouter();
  const now = useMinuteClock();
  const visible = maxItems === null ? items : items.slice(0, maxItems);
  const showAllLink = maxItems !== null && items.length > maxItems;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; undo?: UndoAction } | null>(null);

  async function execute(id: string, name: ChatServerActionName, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      const result = await runChatServerAction(name, payload);
      setNotice({ message: result.message, undo: result.ok ? result.undo?.action : undefined });
      if (result.ok) {
        setReschedulingId(null);
        router.refresh();
      }
    } catch {
      setNotice({ message: "Não consegui atualizar este retorno. Tente de novo." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="agenda-heading" className="arc-venancor flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="agenda-heading" className="text-base font-semibold text-(--foreground)">{heading}</h2>
        {showAllLink ? (
          <Link href="/agenda" className="inline-flex min-h-11 items-center text-sm font-medium text-(--accent-strong)">
            Ver retornos
          </Link>
        ) : null}
      </div>
      {notice ? (
        <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--text-secondary)" role="status" aria-live="polite">
          <span>{notice.message}</span>
          {notice.undo ? <Button size="sm" variant="secondary" loading={busyId === "undo"} onClick={() => execute("undo", notice.undo!.name, notice.undo!.payload)}>Desfazer</Button> : null}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className="rounded-3xl bg-(--surface-muted) p-5 text-sm text-(--text-secondary) shadow-(--shadow-resting)">
          Nenhum compromisso agendado. Retornos e tarefas com data aparecem aqui.
        </p>
      ) : (
        <ul className={interactive ? "grid gap-3" : "grid overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)"}>
          {visible.map((item) => {
            const overdue = now !== null && item.dueAt !== null && new Date(item.dueAt).getTime() < now.getTime();
            return (
              <li key={item.id} className={interactive ? "grid gap-3 rounded-3xl bg-(--surface-muted) p-4 shadow-(--shadow-resting) sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" : "px-4 py-1"}>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <Link href={item.href} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 active:bg-(--surface-muted)">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-(--foreground)">{item.title}</span>
                      <span className="block truncate text-sm text-(--text-secondary)">{item.leadName}</span>
                    </span>
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {item.dueAt ? <span className="text-sm tabular-nums text-(--text-secondary)">{formatAgendaWhen(item.dueAt, now)}</span> : null}
                    {overdue ? <Badge tone="warning" size="sm">Atrasada</Badge> : null}
                  </span>
                </div>
                {interactive ? (
                  <div className="grid justify-items-start gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" loading={busyId === item.id} disabled={busyId !== null} onClick={() => execute(item.id, "lead.completeReturn", { taskId: item.id })}>Concluir</Button>
                      <Button size="sm" variant="ghost" loading={busyId === item.id} disabled={busyId !== null} onClick={() => execute(item.id, "lead.cancelReturn", { taskId: item.id, leadName: item.leadName })}>Cancelar</Button>
                      <Button size="sm" variant="ghost" disabled={busyId !== null} aria-expanded={reschedulingId === item.id} onClick={() => setReschedulingId(reschedulingId === item.id ? null : item.id)}>Reagendar</Button>
                    </div>
                    {reschedulingId === item.id ? (
                      <div className="flex flex-wrap gap-2" aria-label={`Novo prazo para ${item.leadName}`}>
                        {[
                          { value: "today", label: "Hoje às 18h" },
                          { value: "tomorrow", label: "Amanhã de manhã" },
                          { value: "in_2_days", label: "Em 2 dias" },
                          { value: "in_3_days", label: "Em 3 dias" },
                        ].map((option) => (
                          <Button key={option.value} size="sm" variant="secondary" loading={busyId === item.id} disabled={busyId !== null} onClick={() => execute(item.id, "lead.scheduleReturn", { leadId: item.leadId, when: option.value, taskId: item.id })}>
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
