"use client";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { LiteDataTable, type LiteColumn } from "@/components/lite/data/data";
import { formatLiteDate } from "@/components/lite/format/date";
import { STAGE_ACTIONS, STEP_NAMES } from "@/features/customer-waiting/domain";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import type { NegotiationWaiting } from "./queries";
import styles from "./negotiations.module.css";

/** "2 h 10 min": business minutes, the clock the guard uses. */
export function formatBusinessMinutes(minutes: number) {
  if (minutes < 1) return "Menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** What the guard would do now and when the next step comes: "2ª cobrança ao corretor e aviso à gestão · troca de corretor às 16:40". */
export function waitingStepText(waiting: NegotiationWaiting) {
  if (waiting.stage !== "watching") {
    const next = waiting.nextStage && waiting.nextStageAt ? ` · ${STEP_NAMES[waiting.nextStage]} às ${formatLiteDate(new Date(waiting.nextStageAt), { hour: "2-digit", minute: "2-digit" })}` : "";
    return `${STAGE_ACTIONS[waiting.stage]}${next}`;
  }
  return waiting.nextStageAt && waiting.nextStage ? `${STEP_NAMES[waiting.nextStage]} às ${formatLiteDate(new Date(waiting.nextStageAt), { hour: "2-digit", minute: "2-digit" })}` : "Aguardando";
}

const columns: LiteColumn<NegotiationWaiting>[] = [
  {
    id: "lead",
    label: "Cliente",
    primary: true,
    render: (row) => (
      <span className={styles.waitingLead}>
        <span className={styles.waitingName}>{row.leadName}{row.urgent ? <span className={styles.signalTag} data-tone="urgent">Cobrando</span> : null}</span>
        {row.customerQuote ? <span className={`${styles.muted} ${styles.tableText}`} title={row.customerQuote}>“{row.customerQuote}”</span> : null}
      </span>
    ),
  },
  { id: "broker", label: "Corretor", secondary: true, nowrap: true, render: (row) => <span title={row.brokerName}><BrokerProfileLink brokerId={row.brokerId} name={row.brokerName} /></span> },
  { id: "wait", label: "Espera útil", numeric: true, nowrap: true, render: (row) => formatBusinessMinutes(row.waitingBusinessMinutes) },
  { id: "step", label: "O que o sistema faria", render: (row) => <span className={styles.tableText} title={waitingStepText(row)}>{waitingStepText(row)}</span> },
  { id: "status", label: "Etapa no CRM", nowrap: true, render: (row) => LEAD_STATUS_LABELS[row.status] ?? row.status },
];

/**
 * Observação F1 (plano 2026-11-04): clientes esperando uma pessoa da empresa, o mais grave primeiro. Inclui quem
 * ainda não aparece como negociação (aceitou a oferta e nunca escreveu). Nada é enviado; a linha abre a conversa.
 */
export function NegotiationWaitingPanel({ rows, onOpen }: { rows: readonly NegotiationWaiting[]; onOpen: (row: NegotiationWaiting) => void }) {
  return (
    <section className={styles.list} aria-labelledby="negotiation-waiting-title">
      <div className={styles.waitingHead}>
        <h2 className={styles.waitingTitle} id="negotiation-waiting-title">Sem retorno do corretor</h2>
        <p className={styles.muted}>Observação: o sistema só registra o que faria. Espera contada em horas úteis (dias úteis, 8h às 18h).</p>
      </div>
      <LiteDataTable
        caption="Clientes esperando resposta do corretor"
        columns={columns}
        rows={[...rows]}
        rowKey={(row) => row.leadId}
        onRowOpen={onOpen}
        empty={<p>Nenhum cliente esperando resposta.</p>}
      />
    </section>
  );
}
