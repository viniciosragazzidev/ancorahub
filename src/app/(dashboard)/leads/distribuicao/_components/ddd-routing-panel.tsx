"use client";

import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone } from "@/components/huge-icons";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { saveDddRoutingSettingsAction } from "@/features/lead-distribution/ddd-routing-actions";
import {
  DDD_OUTCOME_LABELS,
  parseDddList,
  type DddOutcome,
  type DddRoutingSettings,
} from "@/features/lead-distribution/ddd-routing";

/** Select value for "no queue": the lead keeps the normal flow. */
const NORMAL_FLOW = "__normal__";

const OUTCOME_HELP: Record<DddOutcome, string> = {
  valid: "Telefone com um dos DDDs digitados acima.",
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
  const [dddText, setDddText] = useState(initialSettings.validDdds.join(", "));
  const parsed = useMemo(() => parseDddList(dddText), [dddText]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  // Only the typed DDDs are valid; every other area code falls in "DDD inválido".
  const onDddText = (text: string) => {
    setDddText(text);
    setSettings({ ...settings, validDdds: parseDddList(text).valid });
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
    <Card variant="overview">
      <SectionCardHeader
        icon={<Phone />}
        title="Regra de DDD"
        description="Escolha os DDDs atendidos e para qual fila o lead vai em cada situação. Vale para a empresa inteira e é aplicada antes da oferta ao corretor."
        actions={
          <Badge variant={settings.enabled ? "success" : "secondary"}>
            {settings.enabled ? "Ativa" : "Desligada"}
          </Badge>
        }
      />

      <CardContent className="grid gap-5 p-4">
        <div className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border/70 bg-muted/20 p-3">
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

        <div className="grid gap-1.5">
          <Label htmlFor="ddd-valid-list" className="text-xs font-medium">DDDs válidos</Label>
          <Input
            id="ddd-valid-list"
            value={dddText}
            disabled={!canEdit}
            placeholder="Ex.: 21, 22, 24"
            onChange={(event) => onDddText(event.target.value)}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            {parsed.valid.length
              ? `${parsed.valid.length} válido${parsed.valid.length === 1 ? "" : "s"} (${parsed.valid.join(", ")}). Qualquer outro DDD é tratado como inválido.`
              : "Digite os DDDs atendidos, separados por vírgula ou espaço. Qualquer outro DDD será tratado como inválido."}
            {parsed.unknown.length ? ` Ignorados, não existem: ${parsed.unknown.join(", ")}.` : ""}
          </p>
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
