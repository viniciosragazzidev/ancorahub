"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { saveDddRoutingSettingsAction } from "@/features/lead-distribution/ddd-routing-actions";
import {
  BRAZIL_DDDS_BY_STATE,
  DDD_OUTCOME_LABELS,
  type DddOutcome,
  type DddRoutingSettings,
} from "@/features/lead-distribution/ddd-routing";

/** Select value for "no queue": the lead keeps the normal flow. */
const NORMAL_FLOW = "__normal__";

const OUTCOME_HELP: Record<DddOutcome, string> = {
  valid: "Telefone com um dos DDDs marcados abaixo.",
  invalid: "Telefone brasileiro com DDD fora da lista.",
  unknown: "Telefone sem DDD, estrangeiro ou malformado.",
};

export function DddRoutingPanel({
  initialSettings,
  queues,
  canEdit,
}: {
  initialSettings: DddRoutingSettings;
  queues: Array<{ id: string; name: string }>;
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState<DddRoutingSettings>(initialSettings);
  const [saved, setSaved] = useState<DddRoutingSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const valid = useMemo(() => new Set(settings.validDdds), [settings.validDdds]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  const setValid = (ddds: string[], selected: boolean) => {
    const next = new Set(settings.validDdds);
    for (const ddd of ddds) {
      if (selected) next.add(ddd);
      else next.delete(ddd);
    }
    setSettings({ ...settings, validDdds: [...next].sort() });
  };

  const setQueue = (outcome: DddOutcome, value: string) => {
    setSettings({ ...settings, queues: { ...settings.queues, [outcome]: value === NORMAL_FLOW ? null : value } });
  };

  function save() {
    startTransition(async () => {
      const result = await saveDddRoutingSettingsAction(settings);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(settings);
      toast.success(settings.enabled ? "Regra de DDD salva e ativa." : "Regra de DDD salva (desligada).");
    });
  }

  return (
    <Card variant="overview" className="shadow-sm">
      <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Regra de DDD</CardTitle>
            <CardDescription className="mt-1 max-w-3xl leading-5">
              Escolha os DDDs atendidos e para qual fila o lead vai em cada situação. Vale para a
              empresa inteira e é aplicada antes da oferta ao corretor.
            </CardDescription>
          </div>
          <Badge variant={settings.enabled ? "success" : "secondary"}>
            {settings.enabled ? "Ativa" : "Desligada"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 px-5 py-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">Aplicar a regra de DDD</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Desligada, nenhum lead é movido e a distribuição segue como hoje.
            </p>
          </div>
          <Switch
            aria-label="Aplicar a regra de DDD"
            checked={settings.enabled}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          />
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs font-medium">DDDs válidos</Label>
            <span className="text-xs text-muted-foreground">
              {valid.size} de 67 selecionados · os demais são inválidos
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {BRAZIL_DDDS_BY_STATE.map((state) => {
              const allSelected = state.ddds.every((ddd) => valid.has(ddd));
              return (
                <div key={state.uf} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/70 p-2">
                  <button
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={allSelected}
                    onClick={() => setValid([...state.ddds], !allSelected)}
                    className="w-8 text-left text-xs font-semibold text-foreground disabled:cursor-default"
                    title={allSelected ? `Desmarcar ${state.uf}` : `Marcar todo o ${state.uf}`}
                  >
                    {state.uf}
                  </button>
                  {state.ddds.map((ddd) => {
                    const selected = valid.has(ddd);
                    return (
                      <button
                        key={ddd}
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={selected}
                        aria-label={`DDD ${ddd} ${selected ? "válido" : "inválido"}`}
                        onClick={() => setValid([ddd], !selected)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors disabled:cursor-default",
                          selected
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {ddd}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(DDD_OUTCOME_LABELS) as DddOutcome[]).map((outcome) => (
            <div key={outcome} className="grid content-start gap-1.5">
              <Label htmlFor={`ddd-queue-${outcome}`} className="text-xs font-medium">
                {DDD_OUTCOME_LABELS[outcome]}
              </Label>
              <Select
                value={settings.queues[outcome] ?? NORMAL_FLOW}
                onValueChange={(value) => setQueue(outcome, String(value))}
                disabled={!canEdit}
              >
                <SelectTrigger id={`ddd-queue-${outcome}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NORMAL_FLOW}>Seguir distribuição normal</SelectItem>
                  {queues.map((queue) => (
                    <SelectItem key={queue.id} value={queue.id}>
                      Enviar para {queue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-4 text-muted-foreground">{OUTCOME_HELP[outcome]}</p>
            </div>
          ))}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Cada lead movido registra no histórico o DDD e o motivo. A alteração é auditada.
            </p>
            <Button size="sm" variant="outline" disabled={!dirty || isPending} onClick={save}>
              {isPending ? "Salvando…" : "Salvar regra de DDD"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Apenas o Diretor pode alterar esta regra global.</p>
        )}
      </CardContent>
    </Card>
  );
}
