"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { savePostSaleR0SettingsAction } from "@/features/post-sale-audit/actions";
import { R0_DEFAULTS } from "@/features/post-sale-audit/r0-rules";

type R0Settings = { enabled: boolean; queueIds: string[]; canEdit: boolean };

/** Regra R0 (cliente que volta a escrever): liga e desliga e escolhe as filas do piloto. Só o diretor edita. */
export function PostSaleR0Settings({ initial, queues }: { initial: R0Settings; queues: Array<{ id: string; name: string }> }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [queueIds, setQueueIds] = useState<string[]>(initial.queueIds);
  const [feedback, setFeedback] = useState("");
  const [busy, startTransition] = useTransition();
  const disabled = !initial.canEdit || busy;

  function toggleQueue(id: string, checked: boolean) {
    setQueueIds((current) => checked ? [...new Set([...current, id])] : current.filter((queueId) => queueId !== id));
  }

  function save() {
    setFeedback("");
    startTransition(async () => {
      const result = await savePostSaleR0SettingsAction({ enabled, queueIds });
      if (!result.ok) { setFeedback(result.error); return; }
      setEnabled(result.data.enabled);
      setQueueIds(result.data.queueIds);
      setFeedback(result.data.enabled ? `Regra ligada em ${result.data.queueIds.length} ${result.data.queueIds.length === 1 ? "fila" : "filas"}.` : "Regra desligada.");
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Cliente voltou a escrever</CardTitle>
          <CardDescription>
            Quando um cliente que já está com um corretor escreve de novo e fica {R0_DEFAULTS.waitMinutes} min úteis sem resposta (ou escreve depois de o atendimento ser encerrado), a equipe de qualidade pergunta o que aconteceu pelo mesmo número. A direção e o gestor da unidade recebem os alertas; o corretor não é avisado.
          </CardDescription>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={enabled} onCheckedChange={(value) => setEnabled(Boolean(value))} disabled={disabled} aria-label="Ligar a regra do cliente que voltou a escrever" />
          {enabled ? "Ligada" : "Desligada"}
        </label>
      </CardHeader>
      <CardContent className="grid gap-4">
        <fieldset className="grid gap-2" disabled={disabled}>
          <legend className="mb-1 text-sm font-medium">Filas do piloto</legend>
          {queues.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {queues.map((queue) => <label key={queue.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <Checkbox checked={queueIds.includes(queue.id)} onCheckedChange={(value) => toggleQueue(queue.id, Boolean(value))} disabled={disabled} />
              <span className="truncate">{queue.name}</span>
            </label>)}
          </div> : <p className="text-sm text-muted-foreground">Nenhuma fila ativa.</p>}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Proteções: no máximo 1 conversa por cliente a cada {R0_DEFAULTS.cooldownDays} dias, nada se o corretor respondeu nas últimas {R0_DEFAULTS.brokerRecentReplyHours} h, se há pesquisa em andamento, se o cliente pediu para parar ou se o lead é de um diretor. Sem retorno da equipe {R0_DEFAULTS.escalationMinutes} min úteis depois da resposta do cliente, a direção recebe um alerta para repassar o lead. A IA nunca informa preço.
        </p>
        {initial.canEdit ? <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} loading={busy}>Salvar</Button>
          {feedback ? <p className="text-sm text-[var(--text-secondary)]" role="status">{feedback}</p> : null}
        </div> : <p className="text-xs text-muted-foreground">Só a direção pode alterar esta regra.</p>}
      </CardContent>
    </Card>
  );
}
