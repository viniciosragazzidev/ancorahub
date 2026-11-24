import { LEAD_STATUS_LABELS } from "./lead-status-constants";

/**
 * Etapa "Entrei em contato" (24/11/2026): quem registra conta como foi o contato. O texto vai para o
 * histórico de etapas (lead_stage_history.reason) e para a linha do tempo do lead.
 * Plano: docs/implementations/active/2026-11-24-etapa-entrei-em-contato.md
 */
export const CONTACTED_STATUS = "contacted";
export const OBSERVATION_MAX_LENGTH = 2000;
export const MISSING_CONTACT_OBSERVATION = "Conte em poucas palavras como foi o contato.";

/** Observação limpa: espaços nas pontas fora, vazio vira null. */
export function cleanObservation(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** Uma pessoa (não a IA nem uma regra) entrando em "Entrei em contato" precisa contar como foi. */
export function missingContactObservation(input: { newStatus: string; observation: string | null; bySystem: boolean }) {
  return input.newStatus === CONTACTED_STATUS && !input.bySystem && !input.observation;
}

const label = (status: string) => LEAD_STATUS_LABELS[status] ?? status;

/** Texto da linha do tempo para uma mudança de etapa comum (sem perda nem reabertura). */
export function stageChangeTimelineText(input: { previousStatus: string; newStatus: string; observation: string | null }) {
  const { previousStatus, newStatus, observation } = input;
  if (newStatus === CONTACTED_STATUS && observation) {
    const head = previousStatus === CONTACTED_STATUS
      ? "Novo contato registrado"
      : `Status alterado: ${label(previousStatus)} → ${label(newStatus)}`;
    return `${head}. Como foi o contato: ${observation}`;
  }
  return `Status alterado: ${label(previousStatus)} → ${label(newStatus)}.${observation ? ` Observação: ${observation}` : ""}`;
}
