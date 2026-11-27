"use client";

import { useState, useTransition } from "react";
import { savePostSaleHandoffSettingsAction } from "@/features/post-sale-audit/actions";
import { POST_SALE_HANDOFF_EXCLUSION_DAYS } from "@/features/post-sale-audit/handoff-rules";
import { AutomationRow, type RowFeedback } from "./post-sale-auto-rules";

type HandoffSettings = { enabled: boolean; canEdit: boolean };

/**
 * Troca automática de corretor pelo pós-venda (27/11): a regra existia desde 24/11, mas sem chave na tela,
 * então nunca era ligada. Cliente que conta que ficou sem contato ou sem continuidade volta para a fila, sem o
 * corretor antigo. A chave salva na hora; só o diretor liga.
 */
export function PostSaleHandoffSettings({ initial, onSaved }: { initial: HandoffSettings; onSaved?: (settings: { enabled: boolean }) => void }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<RowFeedback>(null);
  const [busy, startTransition] = useTransition();

  function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setFeedback(null);
    startTransition(async () => {
      const result = await savePostSaleHandoffSettingsAction({ enabled: next });
      if (!result.ok) {
        setEnabled(previous);
        setFeedback({ tone: "error", text: `Não salvou: ${result.error}` });
        return;
      }
      setEnabled(result.data.enabled);
      onSaved?.(result.data);
      setFeedback({ tone: "ok", text: result.data.enabled ? "Troca automática ligada. Vale para as próximas conversas." : "Troca automática desligada." });
    });
  }

  return (
    <AutomationRow
      id="troca-corretor"
      title="Troca de corretor sem contato"
      description="Cliente conta na pesquisa que ninguém falou com ele ou que o atendimento parou: o lead volta para a fila e outro corretor recebe."
      enabled={enabled}
      canToggle={initial.canEdit && !busy}
      toggleLabel="Ligar a troca automática de corretor"
      onToggle={toggle}
      open={open}
      onOpenChange={setOpen}
      feedback={feedback}
    >
      <p className="text-xs text-muted-foreground">
        Só troca leads abertos (atendimento, cotação, negociação ou aguardando retorno) que continuam com o corretor avaliado. Não troca lead de diretor, lead em venda automatizada, em documentação, em análise, vendido ou perdido. O corretor antigo é avisado e fica fora das ofertas deste lead por {POST_SALE_HANDOFF_EXCLUSION_DAYS} dias. A distribuição segue o plantão e as filas.
      </p>
      {!initial.canEdit ? <p className="text-xs text-muted-foreground">Só a direção pode alterar esta regra.</p> : null}
    </AutomationRow>
  );
}
