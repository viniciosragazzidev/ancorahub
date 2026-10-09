"use client";

import Link from "next/link";

import { Badge } from "@/components/arc/badge/badge";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { AcceptLeadButton } from "@/features/broker-workspace/components/accept-lead-button";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { ACTION_PRESENTATION, DEFAULT_ACTION } from "./format";

const primary =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-(--accent) px-5 text-sm font-semibold text-(--accent-foreground) disabled:opacity-60";
const secondary =
  "inline-flex h-11 items-center justify-center rounded-full bg-(--surface-muted) px-5 text-sm font-semibold text-(--foreground)";

/** Faça agora: the single most important lead or task, with one main button. */
export function NextAction({ action }: { action: BrokerWorkspaceData["nextAction"] }) {
  if (!action) {
    return (
      <section aria-labelledby="now-heading" className="arc-venancor flex flex-col gap-3">
        <h2 id="now-heading" className="text-base font-semibold text-(--foreground)">Faça agora</h2>
        <EmptyState
          title="Tudo em dia"
          description="Quando chegar um lead ou uma tarefa, ela aparece aqui."
          action={<Link href="/minha-fila" className={secondary}>Ver minha fila</Link>}
        />
      </section>
    );
  }

  const presentation = ACTION_PRESENTATION[action.kind] ?? DEFAULT_ACTION;
  return (
    <section aria-labelledby="now-heading" className="arc-venancor flex flex-col gap-3">
      <h2 id="now-heading" className="text-base font-semibold text-(--foreground)">Faça agora</h2>
      <div className="flex flex-col gap-4 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-(--foreground)">{action.title}</p>
            <p className="mt-1 text-sm text-(--text-secondary)">{action.description}</p>
          </div>
          <Badge tone={presentation.tone}>{presentation.chip}</Badge>
        </div>
        {action.kind === "new_lead" && action.leadId ? (
          <AcceptLeadButton leadId={action.leadId} className={primary}>
            {presentation.button}
          </AcceptLeadButton>
        ) : (
          <Link href={presentation.href(action.leadId)} className={primary}>
            {presentation.button}
          </Link>
        )}
      </div>
    </section>
  );
}
