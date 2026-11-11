"use client";

import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { savePlantaoPrioritySettingsAction } from "@/features/lead-distribution/plantao-priority-actions";
import {
  PLANTAO_WEIGHT_MAX,
  PLANTAO_WEIGHT_MIN,
  PLANTAO_WEIGHT_REASON_LABEL,
  type PlantaoPriorityMode,
  type PlantaoWeightReason,
} from "@/features/lead-distribution/plantao-priority-core";

/** Dados já calculados no servidor (só chegam aqui para o Diretor). */
export type PlantaoPrioritySectionData = {
  flagOn: boolean;
  mode: PlantaoPriorityMode;
  levelByHours: boolean;
  types: Array<{
    typeId: string;
    name: string;
    base: number;
    adaptive: boolean;
    effectiveWeight: number;
    reason: PlantaoWeightReason;
  }>;
};

const MODE_OPTIONS: Array<{ value: PlantaoPriorityMode; label: string }> = [
  { value: "off", label: "Desligado (distribuição de hoje)" },
  { value: "shadow", label: "Sombra (só registra o que mudaria)" },
  { value: "on", label: "Ligado (usa o peso)" },
];

function formatWeight(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Prioridade por tipo de plantão (2026-11-10): peso leve (1,0 a 1,3) para leads
 * quentes e mornos. Comece no modo sombra; ligue só depois de ver o relatório.
 */
export function PlantaoPrioritySection({ data }: { data: PlantaoPrioritySectionData }) {
  const [mode, setMode] = useState<PlantaoPriorityMode>(data.mode);
  const [levelByHours, setLevelByHours] = useState(data.levelByHours);
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(data.types.map((type) => [type.typeId, formatWeight(type.base)])),
  );
  const [saving, setSaving] = useState(false);

  const parsed = Object.fromEntries(
    Object.entries(weights).map(([typeId, raw]) => [typeId, Number(raw.replace(",", "."))]),
  );
  const invalidTypeIds = Object.entries(parsed)
    .filter(([, value]) => !Number.isFinite(value) || value < PLANTAO_WEIGHT_MIN || value > PLANTAO_WEIGHT_MAX)
    .map(([typeId]) => typeId);

  async function save() {
    if (invalidTypeIds.length) {
      toast.error("O peso de cada tipo vai de 1,00 a 1,30.");
      return;
    }
    setSaving(true);
    const result = await savePlantaoPrioritySettingsAction({
      mode,
      levelByHours,
      types: data.types.map((type) => ({ typeId: type.typeId, base: parsed[type.typeId], adaptive: type.adaptive })),
    });
    if (result.success) toast.success("Prioridade por tipo de plantão salva.");
    else toast.error(result.error);
    setSaving(false);
  }

  return (
    <section aria-labelledby="plantao-priority-title" className="grid gap-3 border-t border-border/50 pt-4">
      <div className="grid gap-1">
        <h3 id="plantao-priority-title" className="text-sm font-semibold">Prioridade por tipo de plantão</h3>
        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
          Um plantão com peso 1,15 recebe cerca de 15% a mais de leads quentes e mornos que os demais,
          sem deixar ninguém sem lead. Frios não mudam. Se o tipo passar do teto de fatia do dia, estiver
          sem corretor ou expirando mais de 12% em 2 horas, o peso volta a 1 sozinho.
        </p>
        {!data.flagOn ? (
          <p className="text-xs text-muted-foreground" role="status">
            A função está desligada pelo Super-admin. Você pode deixar a configuração pronta; ela só vale quando for liberada.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="plantao-priority-mode">Modo</FieldLabel>
          <AppSelect
            id="plantao-priority-mode"
            aria-label="Modo da prioridade por tipo de plantão"
            value={mode}
            onValueChange={(value) => setMode(value as PlantaoPriorityMode)}
            options={MODE_OPTIONS}
            disabled={saving}
          />
          <FieldDescription>Comece pela sombra por 1 a 2 semanas e compare no relatório antes de ligar.</FieldDescription>
        </Field>
        <label className="flex items-center gap-2 self-center text-sm">
          <Checkbox checked={levelByHours} disabled={saving} onCheckedChange={(checked) => setLevelByHours(checked === true)} />
          Nivelar por horas de plantão cumpridas (evita a rajada quando a tarde abre)
        </label>
      </div>
      {data.types.length ? (
        <div className="grid gap-2">
          {data.types.map((type) => {
            const invalid = invalidTypeIds.includes(type.typeId);
            return (
              <div key={type.typeId} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1.4fr)]">
                <label className="text-sm font-medium" htmlFor={`plantao-weight-${type.typeId}`}>{type.name}</label>
                <Input
                  id={`plantao-weight-${type.typeId}`}
                  aria-invalid={invalid || undefined}
                  disabled={saving}
                  inputMode="decimal"
                  value={weights[type.typeId] ?? ""}
                  onChange={(event) => setWeights({ ...weights, [type.typeId]: event.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={type.effectiveWeight > 1 ? "info" : "secondary"}>
                    Hoje: {formatWeight(type.effectiveWeight)}
                  </Badge>
                  <span>{PLANTAO_WEIGHT_REASON_LABEL[type.reason]}</span>
                </div>
              </div>
            );
          })}
          {invalidTypeIds.length ? (
            <p className="text-xs text-destructive" role="alert">O peso de cada tipo vai de 1,00 a 1,30.</p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum tipo de plantão ativo. Crie os tipos na aba Plantão.</p>
      )}
      <Button className="w-fit" disabled={saving || Boolean(invalidTypeIds.length)} onClick={save} variant="outline">
        {saving ? "Salvando…" : "Salvar prioridade"}
      </Button>
    </section>
  );
}
