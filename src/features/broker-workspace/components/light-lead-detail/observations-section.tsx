"use client";

import { useState } from "react";
import { CaretRight, NotePencil } from "@phosphor-icons/react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import type { LeadObservation } from "@/features/leads/lead-observations-core";

import { formatDateTime, stageLabel } from "./format";

function stageOf(item: LeadObservation) {
  if (item.toStatus) return stageLabel(item.toStatus);
  return item.stageText ?? "Etapa";
}

/**
 * Histórico de observações (25/11/2026): um toque abre todas as observações registradas com a etapa, da mais
 * nova para a mais antiga, com etapa, autor e data. Abrir é nível 0 (FEEDBACK.md): sem som nem vibração.
 */
export function ObservationsSection({ observations, compactClassName }: {
  observations: LeadObservation[];
  /** Botão curto no cabeçalho da conversa (ao lado de "Dados"), com a classe dele. Sem ela: cartão na ficha. */
  compactClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const latest = observations[0] ?? null;
  return (
    <>
      {compactClassName ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={compactClassName}
          aria-haspopup="dialog"
          aria-label={`Observações do lead (${observations.length})`}
          title="Histórico de observações"
          data-testid="lead-observations-open"
        >
          <NotePencil size={16} aria-hidden="true" />
          <span aria-hidden="true">Obs. ({observations.length})</span>
        </button>
      ) : <button
        type="button"
        onClick={() => setOpen(true)}
        className="arc-venancor flex w-full items-center gap-3 rounded-3xl bg-(--surface) p-4 text-left shadow-(--shadow-resting) transition-transform duration-100 active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        aria-haspopup="dialog"
        data-testid="lead-observations-open"
      >
        <NotePencil size={20} aria-hidden="true" className="shrink-0 text-(--text-secondary)" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold text-(--foreground)">Observações ({observations.length})</span>
          <span className="truncate text-sm text-(--text-secondary)">
            {latest ? `${stageOf(latest)}: ${latest.observation}` : "Nenhuma observação registrada ainda."}
          </span>
        </span>
        <CaretRight size={16} aria-hidden="true" className="shrink-0 text-(--text-secondary)" />
      </button>}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Histórico de observações"
        description="O que foi registrado em cada etapa, da mais nova para a mais antiga."
        detents={[0.9]}
        closeLabel="Fechar"
        className="arc-venancor"
      >
        {observations.length ? (
          <ol className="flex flex-col gap-3 pb-2" aria-label="Observações do lead">
            {observations.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 rounded-2xl border border-(--border) p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-semibold text-(--foreground)">{stageOf(item)}</span>
                  <time dateTime={item.createdAt} className="text-xs text-(--text-secondary)">{formatDateTime(item.createdAt)}</time>
                </div>
                <p className="whitespace-pre-line break-words text-sm text-(--foreground)">{item.observation}</p>
                <span className="text-xs text-(--text-secondary)">{item.authorName ?? "Autor não identificado"}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="pb-2 text-sm text-(--text-secondary)">Nenhuma observação registrada ainda. Ao registrar a etapa com uma observação, ela aparece aqui.</p>
        )}
      </BottomSheet>
    </>
  );
}
