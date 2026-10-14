"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { reassignLeadAction, type ManagementActionState } from "@/features/leads/management-actions";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import { LitePress } from "@/components/light/light-motion";

export type TransferBroker = { id: string; name: string; image?: string | null; availability?: string };

const availabilityLabel: Record<string, string> = { available: "Disponível", on_duty: "Em plantão", paused: "Pausado", offline: "Fora do ar" };

/**
 * Repassar lead no gestor Lite: a pill abre um sheet com a busca e a lista de corretores da unidade
 * (avatar e situação). O envio usa a mesma action de sempre; o escopo segue checado no servidor.
 */
export function ManagerLeadTransferForm({ leadId, leadName, brokers }: { leadId: string; leadName: string; brokers: TransferBroker[] }) {
  const [state, action, pending] = useActionState<ManagementActionState, FormData>(reassignLeadAction, {});
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [brokerId, setBrokerId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? brokers.filter((broker) => broker.name.toLowerCase().includes(q)) : brokers;
  }, [brokers, query]);
  const chosen = brokers.find((broker) => broker.id === brokerId) ?? null;

  if (state.success) return <section aria-live="polite" className="grid gap-3"><p className="text-sm text-(--foreground)">{state.message ?? `${leadName} foi repassado.`}</p><Link href="/leads" className="text-sm font-medium text-(--chat-action-text)">Voltar aos leads da unidade</Link></section>;

  return <>
    <Button variant="primary" className="w-full" disabled={brokers.length === 0} onClick={() => setOpen(true)}>Repassar lead</Button>
    {!brokers.length ? <p className="text-sm text-(--text-secondary)">Não há corretores ativos nesta unidade.</p> : null}
    <BottomSheet title={`Repassar ${leadName}`} description="Escolha o corretor da unidade que vai atender este lead." open={open} onOpenChange={setOpen} closeLabel="Fechar" detents={[0.72]}>
      <form action={action} aria-label={`Repassar ${leadName}`} className="grid gap-4 px-5 pb-6">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="brokerId" value={brokerId ?? ""} />
        <SearchField label="Buscar corretor" placeholder="Nome do corretor" value={query} onValueChange={setQuery} />
        <ul className="grid gap-2" aria-label="Corretores da unidade">
          {visible.map((broker) => {
            const selected = broker.id === brokerId;
            return <li key={broker.id}>
              <LitePress>
                <button type="button" aria-pressed={selected} onClick={() => setBrokerId(broker.id)} className={`flex w-full min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 ${selected ? "bg-(--chat-action-soft,#e8f0ff) ring-2 ring-(--chat-action)" : "bg-(--surface) shadow-(--shadow-resting) hover:bg-(--surface-muted)"}`}>
                  <Avatar name={broker.name} src={broker.image ?? undefined} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-(--foreground)">{broker.name}</span>
                    <Badge tone={broker.availability === "available" || broker.availability === "on_duty" ? "success" : "neutral"} size="sm">{availabilityLabel[broker.availability ?? "offline"] ?? "Fora do ar"}</Badge>
                  </span>
                </button>
              </LitePress>
            </li>;
          })}
        </ul>
        {!visible.length ? <p className="text-sm text-(--text-secondary)">Nenhum corretor com esse nome.</p> : null}
        {state.needsAssignmentMode ? <div className="flex flex-wrap gap-2" aria-label="Como repassar">
          <Button type="submit" name="assignmentMode" value="direct" disabled={pending || !brokerId}>Atribuir direto</Button>
          <Button type="submit" name="assignmentMode" value="offer" variant="secondary" disabled={pending || !brokerId}>Enviar oferta</Button>
        </div> : <Button type="submit" disabled={pending || !brokerId} className="w-full">{pending ? "Repassando…" : chosen ? `Repassar para ${chosen.name}` : "Escolha um corretor"}</Button>}
        {state.error ? <p role="alert" className="text-sm text-(--danger,#b42318)">{state.error}</p> : null}
      </form>
    </BottomSheet>
  </>;
}
