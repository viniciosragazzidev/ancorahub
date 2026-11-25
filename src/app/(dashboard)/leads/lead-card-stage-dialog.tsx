"use client";

/**
 * Mudança de etapa a partir do ⋯ do cartão do kanban Lite (25/11/2026).
 * - `submitStageChange`: o dono usa o fluxo do corretor (`changeLeadStatusAction`, com relato e proteção da IA);
 *   diretor e gestor usam o fluxo da gestão (`bulkChangeLeadStatusAction` com um lead). O servidor decide.
 * - `LeadStageDialog`: o seletor de motivo de perda de hoje (`MOTIVOS_PERDA`, com a justificativa quando a IA viu
 *   venda em potencial) e o relato de "Entrei em contato". Sucesso só depois do servidor (LiteActionButton).
 */
import { useEffect, useId, useRef, useState } from "react";

import { LiteActionButton, LiteSelect, type LiteActionOutcome } from "@/components/lite/controls";
import controls from "@/components/lite/controls/controls.module.css";
import { isAiPotentialSale } from "@/features/leads/ai-potential-sale";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { MOTIVOS_PERDA, MOTIVO_PERDA_LABELS } from "@/features/leads/lead-status-constants";

import type { StageActor } from "./lead-card-stage";
import styles from "./leads-lite-kanban.module.css";
import { liteStageLabel } from "./lite-stage-labels";
import { bulkChangeLeadStatusAction, changeLeadStatusAction } from "./status-actions";

export type StageChangeInput = {
  leadId: string;
  newStatus: string;
  motivoPerda?: string;
  justificativa?: string;
  observacao?: string;
};

const MIN_JUSTIFICATION = 15;

export async function submitStageChange(actor: StageActor, input: StageChangeInput): Promise<LiteActionOutcome> {
  if (actor === "none") return { ok: false, reason: "Você não pode mudar a etapa deste lead.", retryable: false };
  const form = new FormData();
  form.set("newStatus", input.newStatus);
  if (input.motivoPerda) form.set("motivoPerda", input.motivoPerda);
  if (actor === "owner") {
    form.set("leadId", input.leadId);
    if (input.justificativa) form.set("justificativaRegressao", input.justificativa);
    if (input.observacao) form.set("observacao", input.observacao);
    const result = await changeLeadStatusAction({}, form);
    return result.success ? { ok: true } : { ok: false, reason: result.error };
  }
  form.append("leadIds", input.leadId);
  const result = await bulkChangeLeadStatusAction({}, form);
  if (!result.success) return { ok: false, reason: result.error };
  // O fluxo da gestão pula o lead que não pode mudar; sem ele na lista, a etapa não mudou.
  if (result.changedLeadIds && !result.changedLeadIds.includes(input.leadId)) {
    return { ok: false, reason: "O servidor não mudou a etapa deste lead.", retryable: false };
  }
  return { ok: true };
}

export type StageDialogState = { lead: LeadWorkspaceItem; mode: "lost" | "note"; status: string } | null;

export function LeadStageDialog({ state, actor, onClose, onCommitted }: {
  state: StageDialogState;
  actor: StageActor;
  onClose: () => void;
  onCommitted: (input: { leadIds: string[]; newStatus: string }) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const noteId = useId();
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const fieldsRef = useRef<HTMLDivElement>(null);
  const open = Boolean(state);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setText("");
    const returnTo = document.activeElement as HTMLElement | null;
    window.setTimeout(() => fieldsRef.current?.querySelector<HTMLElement>("button, textarea")?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  if (!state) return null;
  const { lead, mode, status } = state;
  const potentialSale = mode === "lost" && actor === "owner" && isAiPotentialSale(lead.qualificationDetails).isPotentialSale;
  const missing = Math.max(0, MIN_JUSTIFICATION - text.trim().length);
  const valid = mode === "lost" ? Boolean(reason) && (!potentialSale || missing === 0) : text.trim().length > 0;
  const current = liteStageLabel(lead.status);

  return (
    <div className={controls.scrim}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={`${controls.dialog} ${styles.stageDialog}`}>
        <h2 id={titleId} className={controls.dialogTitle}>{mode === "lost" ? "Marcar como perdido" : `Mover para ${liteStageLabel(status)}`}</h2>
        <p id={descriptionId} className={controls.dialogDescription}>
          {mode === "lost" ? `${lead.nome} sai do funil. Escolha o motivo.` : `Conte como foi o contato com ${lead.nome}. O texto fica na linha do tempo.`}
        </p>
        <div ref={fieldsRef} className={styles.stageFields}>
          {mode === "lost" ? (
            <LiteSelect
              label="Motivo da perda"
              value={reason}
              onChange={setReason}
              placeholder="Escolha o motivo"
              options={MOTIVOS_PERDA.map((motivo) => ({ value: motivo, label: MOTIVO_PERDA_LABELS[motivo] }))}
            />
          ) : null}
          {mode === "note" || potentialSale ? (
            <div className={styles.stageField}>
              <label htmlFor={noteId} className={styles.stageLabel}>
                {mode === "note" ? "Como foi o contato?" : "A IA viu venda em potencial. Por que descartar?"}
              </label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={2000}
                className={styles.stageTextarea}
                value={text}
                placeholder={mode === "note" ? "Ex.: liguei, cliente pediu cotação para 3 vidas" : "Explique para a supervisão"}
                onChange={(event) => setText(event.target.value)}
              />
              {potentialSale && text.trim().length > 0 && missing > 0 ? <span className={styles.stageHint}>Faltam {missing} caracteres.</span> : null}
            </div>
          ) : null}
        </div>
        <div className={controls.dialogActions}>
          <button type="button" className={controls.dialogButton} onClick={onClose}>Cancelar</button>
          <LiteActionButton
            busyLabel="Salvando…"
            doneLabel={mode === "lost" ? "Marcado como perdido" : "Etapa salva"}
            keeps={`O lead continua em ${current}.`}
            disabled={!valid}
            onAction={() => submitStageChange(actor, {
              leadId: lead.id,
              newStatus: status,
              motivoPerda: mode === "lost" ? reason : undefined,
              justificativa: potentialSale ? text.trim() : undefined,
              observacao: mode === "note" ? text.trim() : undefined,
            })}
            onDone={() => {
              onCommitted({ leadIds: [lead.id], newStatus: status });
              onClose();
            }}
          >
            {mode === "lost" ? "Marcar perdido" : "Salvar etapa"}
          </LiteActionButton>
        </div>
      </div>
    </div>
  );
}
