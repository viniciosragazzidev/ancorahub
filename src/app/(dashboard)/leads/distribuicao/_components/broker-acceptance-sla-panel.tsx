"use client";

/**
 * Prazo de aceite no Lite (27/11/2026): o interruptor de redistribuir, os minutos em pílulas (ou um número livre) e o
 * salvar no rodapé. Mesmo envio de antes.
 */
import { useState } from "react";

import { LiteActionButton } from "@/components/lite/controls";
import { saveBrokerAcceptanceSlaAction } from "@/features/lead-distribution/sla-actions";
import { PlField, pl } from "../plantao/_components/plantoes-1a1-kit";
import { Chips1a1, Foot1a1, Note1a1, Panel1a1, ToggleRow1a1, pn } from "./panels-1a1";

interface BrokerAcceptanceSlaPanelProps {
  initialMinutes: number;
  initialAutoRedistribute?: boolean;
  canEdit: boolean;
}

const PRESET_MINUTES = [5, 10, 15, 30, 60] as const;

export function BrokerAcceptanceSlaPanel({
  initialMinutes = 15,
  initialAutoRedistribute = true,
  canEdit = true,
}: BrokerAcceptanceSlaPanelProps) {
  const [minutes, setMinutes] = useState<number>(initialMinutes || 15);
  const [autoRedistribute, setAutoRedistribute] = useState<boolean>(initialAutoRedistribute);

  async function save() {
    const res = await saveBrokerAcceptanceSlaAction({ slaFirstContactMinutes: minutes, autoRedistribute });
    return res.success ? { ok: true as const } : { ok: false as const, error: res.error || "Não foi possível salvar o prazo." };
  }

  return (
    <Panel1a1 lead="Quanto tempo o corretor pode demorar para aceitar o lead e iniciar o primeiro contato antes de perder a oportunidade.">
      <ToggleRow1a1
        title="Tirar o lead e passar para o próximo corretor"
        hint="Se o corretor não iniciar o atendimento dentro do prazo, o lead é redistribuído automaticamente para o próximo corretor da escala ou do plantão."
        checked={autoRedistribute}
        onChange={setAutoRedistribute}
        disabled={!canEdit}
        ariaLabel="Redistribuir automaticamente quando o prazo acabar"
        status={{ on: "Redistribuição ativa", off: "Apenas alertas" }}
      />

      <PlField as="p" label="Tempo para aceitar e iniciar o contato">
        <Chips1a1
          label="Minutos para aceitar"
          value={PRESET_MINUTES.includes(minutes as (typeof PRESET_MINUTES)[number]) ? minutes : -1}
          options={PRESET_MINUTES.map((preset) => ({ value: preset, label: `${preset} min` }))}
          onChange={(value) => setMinutes(value)}
          disabled={!canEdit}
        />
        <span className={pn.inline}>
          <input className={pl.input} type="number" min={1} max={1440} aria-label="Minutos para aceitar" value={minutes} disabled={!canEdit} onChange={(event) => setMinutes(Math.max(1, Number(event.target.value) || 1))} />
          <span className={pl.small}>minutos</span>
        </span>
      </PlField>

      <Note1a1>
        A cada minuto o sistema confere os leads distribuídos. Passados {minutes} {minutes === 1 ? "minuto" : "minutos"} sem que o corretor registre o primeiro contato ou abra o atendimento, o lead é transferido, com registro na auditoria.
      </Note1a1>

      {canEdit ? (
        <Foot1a1 note="Vale para os próximos leads distribuídos.">
          <LiteActionButton busyLabel="Salvando…" doneLabel="Prazo salvo" keeps="O prazo anterior continua valendo." onAction={save}>
            Salvar prazo
          </LiteActionButton>
        </Foot1a1>
      ) : null}
    </Panel1a1>
  );
}
