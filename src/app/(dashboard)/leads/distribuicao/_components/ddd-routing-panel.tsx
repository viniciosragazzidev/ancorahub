"use client";

/**
 * Regra de DDD no Lite (27/11/2026): o interruptor e o selo leem o mesmo valor (antes o selo vinha do salvo e o
 * interruptor do rascunho), DDDs num campo em pílula, o destino de cada situação num seletor Lite e o salvar no rodapé.
 */
import { useMemo, useState } from "react";

import { LiteActionButton, LiteSelect } from "@/components/lite/controls";
import { saveDddRoutingSettingsAction } from "@/features/lead-distribution/ddd-routing-actions";
import {
  DDD_OUTCOME_LABELS,
  parseDddList,
  type DddOutcome,
  type DddRoutingSettings,
} from "@/features/lead-distribution/ddd-routing";
import { PlField, PlSection, pl } from "../plantao/_components/plantoes-1a1-kit";
import { Foot1a1, Note1a1, Panel1a1, ToggleRow1a1 } from "./panels-1a1";

/** Valor de "nenhuma fila": o lead segue o fluxo normal. */
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
  const [dddText, setDddText] = useState(initialSettings.validDdds.join(", "));
  const parsed = useMemo(() => parseDddList(dddText), [dddText]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const options = useMemo(() => [{ value: NORMAL_FLOW, label: "Seguir distribuição normal" }, ...queues.map((queue) => ({ value: queue.id, label: `Enviar para ${queue.name}` }))], [queues]);

  // Só os DDDs digitados são válidos; qualquer outro cai em "DDD inválido".
  const onDddText = (text: string) => {
    setDddText(text);
    setSettings({ ...settings, validDdds: parseDddList(text).valid });
  };

  const setQueue = (outcome: DddOutcome, value: string) => {
    setSettings({ ...settings, queues: { ...settings.queues, [outcome]: value === NORMAL_FLOW ? null : value } });
  };

  async function save() {
    const result = await saveDddRoutingSettingsAction(settings);
    if (!result.success) return { ok: false as const, error: result.error };
    setSaved(settings);
    return { ok: true as const };
  }

  return (
    <Panel1a1 lead="Escolha os DDDs atendidos e para qual fila o lead vai em cada situação. Vale para a empresa inteira e é aplicada antes da oferta ao corretor.">
      <ToggleRow1a1
        title="Aplicar a regra de DDD"
        hint="Desligada, nenhum lead é movido e a distribuição segue como hoje."
        checked={settings.enabled}
        onChange={(checked) => setSettings({ ...settings, enabled: checked })}
        disabled={!canEdit}
        ariaLabel="Aplicar a regra de DDD"
        status={{ on: "Ligada", off: "Desligada" }}
      />

      <PlField
        label="DDDs válidos"
        htmlFor="ddd-valid-list"
        hint={
          <>
            {parsed.valid.length
              ? `${parsed.valid.length} ${parsed.valid.length === 1 ? "válido" : "válidos"} (${parsed.valid.join(", ")}). Qualquer outro DDD é tratado como inválido.`
              : "Digite os DDDs atendidos, separados por vírgula ou espaço. Qualquer outro DDD será tratado como inválido."}
            {parsed.unknown.length ? ` Ignorados, não existem: ${parsed.unknown.join(", ")}.` : ""}
          </>
        }
      >
        <input id="ddd-valid-list" className={pl.input} value={dddText} disabled={!canEdit} placeholder="Ex.: 21, 22, 24" onChange={(event) => onDddText(event.target.value)} />
      </PlField>

      <PlSection title="Para onde vai o lead">
        {(Object.keys(DDD_OUTCOME_LABELS) as DddOutcome[]).map((outcome) => (
          <div key={outcome} className={pl.field}>
            {canEdit ? (
              <LiteSelect label={DDD_OUTCOME_LABELS[outcome]} value={settings.queues[outcome] ?? NORMAL_FLOW} options={options} onChange={(value) => setQueue(outcome, value)} searchPlaceholder="Buscar fila" />
            ) : (
              <>
                <p className={pl.label} style={{ margin: 0 }}>{DDD_OUTCOME_LABELS[outcome]}</p>
                <p className={pl.small}>{options.find((option) => option.value === (settings.queues[outcome] ?? NORMAL_FLOW))?.label}</p>
              </>
            )}
            <p className={pl.small}>{OUTCOME_HELP[outcome]}</p>
          </div>
        ))}
      </PlSection>

      {canEdit ? (
        <Foot1a1 note={dirty ? "Alterações não salvas." : "Cada lead movido registra no histórico o DDD e o motivo. A alteração é auditada."}>
          <LiteActionButton
            busyLabel="Salvando…"
            doneLabel="Regra salva"
            keeps="A regra anterior continua valendo."
            disabled={!dirty}
            onAction={save}
          >
            Salvar regra de DDD
          </LiteActionButton>
        </Foot1a1>
      ) : (
        <Note1a1>Apenas o Diretor pode alterar esta regra global.</Note1a1>
      )}
    </Panel1a1>
  );
}
