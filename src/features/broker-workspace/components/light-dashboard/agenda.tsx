"use client";

import Link from "next/link";

import { Badge } from "@/components/arc/badge/badge";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { formatAgendaWhen } from "./format";
import { useMinuteClock } from "./use-minute-clock";

const MAX_ITEMS = 4;

/** Short agenda: the next tasks and returns with a date, soonest first. */
export function Agenda({ items }: { items: BrokerWorkspaceData["agenda"] }) {
  const now = useMinuteClock();
  const visible = items.slice(0, MAX_ITEMS);

  return (
    <section aria-labelledby="agenda-heading" className="arc-venancor flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="agenda-heading" className="text-base font-semibold text-(--foreground)">Agenda</h2>
        {items.length > MAX_ITEMS ? (
          <Link href="/minha-fila?filter=returns" className="inline-flex min-h-11 items-center text-sm font-medium text-(--accent-strong)">
            Ver retornos
          </Link>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-3xl bg-(--surface) p-5 text-sm text-(--text-secondary) shadow-(--shadow-resting)">
          Nenhum compromisso agendado. Retornos e tarefas com data aparecem aqui.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-(--surface) shadow-(--shadow-resting)">
          {visible.map((item) => {
            const overdue = now !== null && item.dueAt !== null && new Date(item.dueAt).getTime() < now.getTime();
            return (
              <li key={item.id} className="border-b border-(--border) last:border-b-0">
                <Link href={item.href} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 active:bg-(--surface-muted)">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-(--foreground)">{item.title}</span>
                    <span className="block truncate text-sm text-(--text-secondary)">{item.leadName}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {item.dueAt ? <span className="text-sm tabular-nums text-(--text-secondary)">{formatAgendaWhen(item.dueAt, now)}</span> : null}
                    {overdue ? <Badge tone="warning" size="sm">Atrasada</Badge> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
