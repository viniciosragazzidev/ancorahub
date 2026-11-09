"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { savePostSaleR0SettingsAction } from "@/features/post-sale-audit/actions";
import { R0_DEFAULTS } from "@/features/post-sale-audit/r0-rules";
import { AutomationRow, CheckList, type Option, type RowFeedback } from "./post-sale-auto-rules";

type R0Settings = { enabled: boolean; queueIds: string[]; canEdit: boolean };

function sameIds(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function scopeLine(queueIds: string[]) {
  return `Piloto em ${queueIds.length} ${queueIds.length === 1 ? "fila" : "filas"}.`;
}

/**
 * Regra R0 (cliente que volta a escrever) como linha compacta: a chave salva na hora; as filas do
 * piloto ficam em "Ajustar". Pelo plano, ligada sem fila não dispara, então a chave pede uma fila. Só o diretor edita.
 */
export function PostSaleR0Settings({ initial, queues, onSaved }: { initial: R0Settings; queues: Option[]; onSaved?: (settings: { enabled: boolean; queueIds: string[] }) => void }) {
  const [saved, setSaved] = useState({ enabled: initial.enabled, queueIds: initial.queueIds });
  const [queueIds, setQueueIds] = useState<string[]>(initial.queueIds);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<RowFeedback>(null);
  const [busy, startTransition] = useTransition();
  const disabled = !initial.canEdit || busy;
  const dirty = !sameIds(queueIds, saved.queueIds);

  function persist(next: { enabled: boolean; queueIds: string[] }, okText: (data: { enabled: boolean; queueIds: string[] }) => string) {
    const previous = saved;
    setSaved(next);
    setFeedback(null);
    startTransition(async () => {
      const result = await savePostSaleR0SettingsAction(next);
      if (!result.ok) {
        setSaved(previous);
        setFeedback({ tone: "error", text: `Não salvou: ${result.error}` });
        return;
      }
      setSaved(result.data);
      setQueueIds(result.data.queueIds);
      onSaved?.(result.data);
      setFeedback({ tone: "ok", text: okText(result.data) });
    });
  }

  function toggle(next: boolean) {
    const ids = open && dirty ? queueIds : saved.queueIds;
    if (next && !ids.length) {
      setOpen(true);
      setFeedback({ tone: "error", text: "Escolha pelo menos uma fila do piloto abaixo. Ligada sem fila, a R0 não dispara." });
      return;
    }
    persist({ enabled: next, queueIds: ids }, (data) => data.enabled ? `Regra R0 ligada. ${scopeLine(data.queueIds)}` : "Regra R0 desligada.");
  }

  function save() {
    if (saved.enabled && !queueIds.length) {
      setFeedback({ tone: "error", text: "Com a R0 ligada, deixe pelo menos uma fila. Para parar, desligue a chave." });
      return;
    }
    persist({ enabled: saved.enabled, queueIds }, (data) => data.enabled ? `Filas da R0 salvas. ${scopeLine(data.queueIds)}` : `Filas da R0 salvas (${data.queueIds.length}). A regra segue desligada.`);
  }

  return (
    <AutomationRow
      id="regra-R0"
      title="R0 · Cliente voltou a escrever"
      description={`Cliente com corretor escreve de novo e fica ${R0_DEFAULTS.waitMinutes} min úteis sem resposta: a qualidade pergunta o que houve.`}
      scope={scopeLine(saved.queueIds)}
      enabled={saved.enabled}
      canToggle={!disabled}
      toggleLabel="Ligar a regra do cliente que voltou a escrever"
      onToggle={toggle}
      open={open}
      onOpenChange={setOpen}
      feedback={feedback}
    >
      <p className="text-xs text-muted-foreground">
        Também dispara quando o cliente escreve depois de o atendimento ser encerrado. A direção e o gestor da unidade recebem os alertas; o corretor não é avisado. Sem retorno da equipe {R0_DEFAULTS.escalationMinutes} min úteis depois da resposta do cliente, a direção recebe um alerta para repassar o lead.
      </p>
      <CheckList
        legend="Filas do piloto (obrigatório para ligar)"
        options={queues}
        selected={queueIds}
        disabled={disabled}
        empty="Nenhuma fila ativa."
        onToggle={(id, checked) => setQueueIds((current) => checked ? [...new Set([...current, id])] : current.filter((queueId) => queueId !== id))}
      />
      {initial.canEdit ? <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} loading={busy} disabled={!dirty}>Salvar filas</Button>
        {dirty ? <span className="text-xs text-muted-foreground">Alterações não salvas.</span> : null}
      </div> : <p className="text-xs text-muted-foreground">Só a direção pode alterar esta regra.</p>}
    </AutomationRow>
  );
}
