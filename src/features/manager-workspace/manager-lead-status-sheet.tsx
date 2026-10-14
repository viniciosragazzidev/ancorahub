"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { LitePress } from "@/components/light/light-motion";
import { LEAD_STATUS_LABELS, MOTIVOS_PERDA, VALID_TRANSITIONS } from "@/features/leads/lead-status-constants";
import { changeManagerLeadStatusAction, type ManagerLeadStatusState } from "./manager-lead-status-action";

const reasonLabel = (reason: string) => reason.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

/** Alterar etapa do lead na ficha do gestor Lite: só as etapas que o pipeline permite a partir da atual. */
export function ManagerLeadStatusSheet({ leadId, leadName, currentStatus }: { leadId: string; leadName: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ManagerLeadStatusState, FormData>(changeManagerLeadStatusAction, {});
  const [next, setNext] = useState<string | null>(null);
  const router = useRouter();
  const options = (VALID_TRANSITIONS[currentStatus] ?? []).filter((status) => status !== currentStatus && status !== "converted");

  return <>
    <Button variant="secondary" onClick={() => setOpen(true)}>Alterar etapa</Button>
    <BottomSheet title="Alterar etapa" description={`${leadName} · etapa atual: ${LEAD_STATUS_LABELS[currentStatus] ?? currentStatus}`} open={open} onOpenChange={setOpen} closeLabel="Fechar" detents={[0.72]}>
      {state.success ? (
        <div className="grid gap-3 px-5 pb-6" aria-live="polite">
          <p className="text-base font-semibold text-(--foreground)">Etapa alterada para {LEAD_STATUS_LABELS[state.newStatus ?? ""] ?? state.newStatus}.</p>
          <Button variant="secondary" onClick={() => { setOpen(false); router.refresh(); }}>Fechar</Button>
        </div>
      ) : (
        <form action={action} aria-label="Nova etapa do lead" className="grid gap-4 px-5 pb-6">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="newStatus" value={next ?? ""} />
          {options.length === 0 ? <p className="text-sm text-(--text-secondary)">Este lead não tem outra etapa disponível agora.</p> : null}
          <ul className="grid gap-2" aria-label="Etapas disponíveis">
            {options.map((status) => {
              const selected = next === status;
              return <li key={status}>
                <LitePress>
                  <button type="button" aria-pressed={selected} onClick={() => setNext(status)} className={`flex w-full min-h-14 items-center justify-between rounded-2xl px-4 py-3 text-left text-base font-medium transition-colors duration-150 ${selected ? "bg-(--chat-action-soft,#e8f0ff) ring-2 ring-(--chat-action)" : "bg-(--surface) shadow-(--shadow-resting) hover:bg-(--surface-muted)"}`}>
                    {LEAD_STATUS_LABELS[status] ?? status}
                    {selected ? <span aria-hidden="true" className="text-(--chat-action-text)">✓</span> : null}
                  </button>
                </LitePress>
              </li>;
            })}
          </ul>
          {next === "lost" ? <fieldset className="grid gap-2" aria-label="Motivo da perda">
            <legend className="mb-1 text-sm font-medium text-(--foreground)">Motivo da perda</legend>
            {MOTIVOS_PERDA.map((reason) => <label key={reason} className="flex min-h-11 items-center gap-3 rounded-xl bg-(--surface) px-4 text-sm shadow-(--shadow-resting)">
              <input type="radio" name="motivoPerda" value={reason} required className="size-4 accent-(--chat-action)" />
              {reasonLabel(reason)}
            </label>)}
          </fieldset> : null}
          {state.error ? <p role="alert" className="text-sm text-(--danger,#b42318)">{state.error}</p> : null}
          <Button type="submit" disabled={pending || !next} className="w-full">{pending ? "Salvando…" : next ? `Mover para ${LEAD_STATUS_LABELS[next] ?? next}` : "Escolha uma etapa"}</Button>
        </form>
      )}
    </BottomSheet>
  </>;
}
