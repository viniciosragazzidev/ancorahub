"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { addPendingRosterEntryAction, removePendingRosterEntryAction } from "@/features/lead-distribution/duty-roster-pending-actions";

type Person = { id: string; name: string; internalCode: string | null; branchName: string | null };

const label = (person: Person) => [person.name, person.internalCode ? `Código ${person.internalCode}` : null, person.branchName].filter(Boolean).join(" · ");

/**
 * Invited brokers (registered, no account yet) on this plantão: marked
 * "Convite pendente", they receive no lead until they create the account,
 * when they join the roster on their own. The manager can add or remove them.
 */
export function PendingRoster({ scheduleId, entries, candidates }: { scheduleId: string; entries: Array<Person & { entryId: string }>; candidates: Person[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState("");
  const available = candidates.filter((candidate) => !entries.some((entry) => entry.id === candidate.id));

  function run(action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) { toast.error(result.error); return; }
      toast.success(done);
      setChoice("");
      router.refresh();
    });
  }

  if (!entries.length && !available.length) return null;
  return (
    <section aria-label="Escalados com convite pendente" className="space-y-2 rounded-[var(--radius-card)] border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Convite pendente <span className="text-muted-foreground">({entries.length})</span></p>
        <p className="text-xs text-muted-foreground">Ainda sem conta: não recebem leads. Entram na escala sozinhos ao aceitar o convite.</p>
      </div>
      {entries.length ? (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.entryId} className="flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{label(entry)}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant="warning">Convite pendente</Badge>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removePendingRosterEntryAction({ scheduleId, entryId: entry.entryId }), "Removido do plantão.")}>Remover</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {available.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            aria-label="Corretor convidado para escalar"
            className="min-w-56 flex-1"
            value={choice}
            onValueChange={setChoice}
            placeholder="Escalar corretor convidado (sem conta ainda)"
            options={available.map((person) => ({ value: person.id, label: label(person) }))}
          />
          <Button size="sm" disabled={!choice || pending} onClick={() => run(() => addPendingRosterEntryAction({ scheduleId, brokerProfileId: choice }), "Escalado. Entra no plantão quando criar a conta.")}>Escalar</Button>
        </div>
      ) : null}
    </section>
  );
}
