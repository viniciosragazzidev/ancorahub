"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { MagnifyingGlass } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { longDutyDate, shortDutyDate, swapCandidateMatches, whatsappStatusLabel, type SwapCandidate } from "@/features/lead-distribution/duty-swap";
import { listDutySwapCandidatesAction, swapDutyAssignmentsAction, type DutySwapResult, type DutySwapSourceView } from "@/features/lead-distribution/duty-swap-actions";
import { cn } from "@/lib/utils";

type Done = Extract<DutySwapResult, { ok: true }>;

const time = (value: string) => value.slice(0, 5);

/**
 * "Efetuar troca" inside the broker drawer: pick a broker of a future plantão of the
 * published escala, confirm, and both swap places. Shows whether each WhatsApp went out.
 */
export function DutySwapPicker({ assignmentId, onCancel, onSwapped }: {
  assignmentId: string;
  onCancel: () => void;
  onSwapped: (result: Done) => void;
}) {
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const [source, setSource] = useState<DutySwapSourceView | null>(null);
  const [candidates, setCandidates] = useState<SwapCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<SwapCandidate | null>(null);

  useEffect(() => {
    startLoading(async () => {
      const result = await listDutySwapCandidatesAction(assignmentId);
      if (result.ok) {
        setSource(result.source);
        setCandidates(result.candidates);
      } else setError(result.reason);
    });
  }, [assignmentId]);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    return candidates.filter((item) => swapCandidateMatches(item, query));
  }, [candidates, query]);

  function confirm() {
    if (!chosen) return;
    setError(null);
    startSaving(async () => {
      const result = await swapDutyAssignmentsAction({ sourceAssignmentId: assignmentId, targetAssignmentId: chosen.assignmentId });
      if (result.ok) onSwapped(result);
      else setError(result.reason);
    });
  }

  return (
    <section aria-label="Efetuar troca" className="grid gap-3 rounded-[var(--radius-card)] border border-border/70 bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Efetuar troca</h3>
          <p className="text-xs text-muted-foreground">
            {source
              ? `${source.brokerName} está em ${source.scheduleName}, ${longDutyDate(source.dutyDate)}, das ${time(source.startsAt)} às ${time(source.endsAt)}. Escolha com quem trocar.`
              : "Escolha um corretor de um plantão futuro (escala publicada ou plantão de um dia só)."}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>Fechar</Button>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading && !candidates ? <p className="text-sm text-muted-foreground">Carregando plantões…</p> : null}

      {chosen && source ? (
        <div role="alert" className="grid gap-2 rounded-lg border border-warning/50 bg-background p-3 text-sm">
          <p>
            Trocar <strong className="font-medium">{source.brokerName}</strong> e <strong className="font-medium">{chosen.brokerName}</strong>?
          </p>
          <ul className="grid gap-1 text-xs text-muted-foreground">
            <li>{source.brokerName} vai para {chosen.scheduleName}, {longDutyDate(chosen.dutyDate)}, das {time(chosen.startsAt)} às {time(chosen.endsAt)}.</li>
            <li>{chosen.brokerName} vai para {source.scheduleName}, {longDutyDate(source.dutyDate)}, das {time(source.startsAt)} às {time(source.endsAt)}.</li>
          </ul>
          <p className="text-xs text-muted-foreground">Os dois recebem um WhatsApp com a nova data.</p>
          <span className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={saving} onClick={confirm}>{saving ? "Trocando…" : "Confirmar troca"}</Button>
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setChosen(null)}>Voltar</Button>
          </span>
        </div>
      ) : null}

      {candidates && !chosen ? (
        <>
          <label className="relative block">
            <span className="sr-only">Buscar por corretor, código, plantão ou data</span>
            <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por corretor, código, plantão ou data" className="pl-8" />
          </label>
          {filtered.length ? (
            <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/70 bg-card">
              {filtered.map((item) => (
                <li key={item.assignmentId}>
                  <button
                    type="button"
                    onClick={() => setChosen(item)}
                    className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                    aria-label={`Trocar com ${item.brokerName}, ${item.scheduleName}, ${longDutyDate(item.dutyDate)}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.brokerName}{item.brokerCode ? <span className="ml-1 text-xs font-normal text-muted-foreground">({item.brokerCode})</span> : null}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.scheduleName} · {time(item.startsAt)} às {time(item.endsAt)}</span>
                    </span>
                    <Badge variant="outline" className="shrink-0 tabular-nums">{shortDutyDate(item.dutyDate)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {candidates.length ? "Nenhum plantão encontrado para essa busca." : "Não há plantões futuros com data para trocar com este corretor."}
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

/** Result of the swap just made: both WhatsApp statuses. */
export function DutySwapDoneNotice({ result }: { result: Done }) {
  return (
    <div role="status" className="grid gap-1 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
      <p className="font-medium">Troca feita entre {result.source.brokerName} e {result.target.brokerName}.</p>
      <p className="text-xs text-muted-foreground">
        {result.source.brokerName}: {whatsappStatusLabel(result.source.whatsapp)}. {result.target.brokerName}: {whatsappStatusLabel(result.target.whatsapp)}.
      </p>
    </div>
  );
}
