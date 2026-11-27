"use client";

/**
 * Prioridade por tipo de plantão (2026-11-10): peso leve (1,0 a 1,3) para leads quentes e mornos. Comece no modo
 * sombra; ligue só depois de ver o relatório. No visual Lite (27/11/2026), dentro da gaveta de distribuição
 * inteligente: o salvar daqui é secundário (o primário da gaveta é "Salvar distribuição").
 */
import { useState } from "react";

import { toast } from "@/components/ui/sonner";
import { savePlantaoPrioritySettingsAction } from "@/features/lead-distribution/plantao-priority-actions";
import {
  PLANTAO_WEIGHT_MAX,
  PLANTAO_WEIGHT_MIN,
  PLANTAO_WEIGHT_REASON_LABEL,
  type PlantaoPriorityMode,
  type PlantaoWeightReason,
} from "@/features/lead-distribution/plantao-priority-core";
import { cn } from "@/lib/utils";
import { PlField, PlSection, PlSegmented, pl } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1-kit";
import { Note1a1, ToggleRow1a1, pn } from "@/app/(dashboard)/leads/distribuicao/_components/panels-1a1";

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

const MODE_OPTIONS: Array<{ value: PlantaoPriorityMode; label: string; sub: string }> = [
  { value: "off", label: "Desligado", sub: "distribuição de hoje" },
  { value: "shadow", label: "Sombra", sub: "só registra" },
  { value: "on", label: "Ligado", sub: "usa o peso" },
];

function formatWeight(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
    <PlSection
      id="plantao-priority-title"
      title="Prioridade por tipo de plantão"
      hint="Um plantão com peso 1,15 recebe cerca de 15% a mais de leads quentes e mornos que os demais, sem deixar ninguém sem lead. Frios não mudam. Se o tipo passar do teto de fatia do dia, estiver sem corretor ou expirando mais de 12% em 2 horas, o peso volta a 1 sozinho."
    >
      {!data.flagOn ? <Note1a1>A função está desligada pelo Super-admin. Você pode deixar a configuração pronta; ela só vale quando for liberada.</Note1a1> : null}
      <PlField as="p" label="Modo" hint="Comece pela sombra por 1 a 2 semanas e compare no relatório antes de ligar.">
        <PlSegmented label="Modo da prioridade por tipo de plantão" value={mode} onChange={setMode} options={MODE_OPTIONS} disabled={saving} />
      </PlField>
      <ToggleRow1a1
        title="Nivelar por horas de plantão cumpridas"
        hint="Evita a rajada quando a tarde abre."
        checked={levelByHours}
        onChange={setLevelByHours}
        disabled={saving}
        ariaLabel="Nivelar por horas de plantão cumpridas"
      />
      {data.types.length ? (
        <ul className={pn.list}>
          {data.types.map((type) => {
            const invalid = invalidTypeIds.includes(type.typeId);
            return (
              <li key={type.typeId} className={pn.row}>
                <span className={pn.rowBody}>
                  <label className={pn.rowTitle} htmlFor={`plantao-weight-${type.typeId}`}>{type.name}</label>
                  <span className={pn.rowMeta}>Hoje {formatWeight(type.effectiveWeight)} · {PLANTAO_WEIGHT_REASON_LABEL[type.reason]}</span>
                </span>
                <input
                  id={`plantao-weight-${type.typeId}`}
                  className={pl.input}
                  style={{ width: 96, flex: "none", borderColor: invalid ? "var(--danger)" : undefined }}
                  aria-invalid={invalid || undefined}
                  disabled={saving}
                  inputMode="decimal"
                  value={weights[type.typeId] ?? ""}
                  onChange={(event) => setWeights({ ...weights, [type.typeId]: event.target.value })}
                />
              </li>
            );
          })}
        </ul>
      ) : <p className={pl.emptyBox}>Nenhum tipo de plantão ativo. Crie os tipos na aba Plantões.</p>}
      {invalidTypeIds.length ? <p className={cn(pl.small)} style={{ color: "var(--danger)" }} role="alert">O peso de cada tipo vai de 1,00 a 1,30.</p> : null}
      <button type="button" className={cn(pl.pill, pl.pillQuiet)} style={{ alignSelf: "flex-start" }} disabled={saving || Boolean(invalidTypeIds.length)} onClick={() => void save()}>
        {saving ? "Salvando…" : "Salvar prioridade"}
      </button>
    </PlSection>
  );
}
