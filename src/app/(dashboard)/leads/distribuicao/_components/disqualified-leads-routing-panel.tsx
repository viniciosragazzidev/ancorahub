"use client";

/** Leads desqualificados no Lite (27/11/2026): um interruptor que salva na hora, como antes, com o estado ao lado. */
import { useState, useTransition } from "react";

import { toast } from "@/components/ui/sonner";
import { saveDisqualifiedRoutingSettingAction } from "@/features/lead-distribution/disqualified-routing-actions";
import { Note1a1, Panel1a1, ToggleRow1a1 } from "./panels-1a1";

export function DisqualifiedLeadsRoutingPanel({
  initialHoldDisqualifiedLeads,
  canEdit,
}: {
  initialHoldDisqualifiedLeads: boolean;
  canEdit: boolean;
}) {
  const [enabled, setEnabled] = useState(initialHoldDisqualifiedLeads);
  const [isPending, startTransition] = useTransition();

  function save(nextValue: boolean) {
    const previousValue = enabled;
    setEnabled(nextValue);
    startTransition(async () => {
      const result = await saveDisqualifiedRoutingSettingAction({ holdDisqualifiedLeads: nextValue });
      if (!result.success) {
        setEnabled(previousValue);
        toast.error(result.error);
        return;
      }
      toast.success(nextValue ? "Leads desqualificados ficarão em espera." : "Leads desqualificados podem voltar ao fluxo automático.");
    });
  }

  return (
    <Panel1a1 lead="Controle global para manter leads desqualificados em espera, sem enviá-los a um corretor automaticamente.">
      <ToggleRow1a1
        title="Reter desqualificados antes da oferta"
        hint="Quando ativado, vale para qualquer origem, unidade ou fila. Uma regra de roteamento criada manualmente com o status “Desqualificado” pode liberar uma exceção."
        checked={enabled}
        onChange={save}
        disabled={!canEdit || isPending}
        ariaLabel="Reter leads desqualificados em espera"
        status={{ on: "Em espera", off: "Distribuição normal" }}
      />
      {canEdit ? (
        <Note1a1>
          Padrão: desligado. A alteração é registrada na auditoria. <span aria-live="polite">{isPending ? "Salvando…" : "Salvo."}</span>
        </Note1a1>
      ) : (
        <Note1a1>Apenas o Diretor pode alterar esta configuração global.</Note1a1>
      )}
    </Panel1a1>
  );
}
