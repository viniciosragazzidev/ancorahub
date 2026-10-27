"use client";

import { intentLabel, stageLabel } from "@/features/conversation-intelligence/components/radar-model";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import type { NegotiationLead } from "./queries";
import { LEVEL_LABELS } from "./negotiations-data-views";
import styles from "./negotiations.module.css";

const TRAIL = [
  { id: "in_conversation", label: "Em conversa" },
  { id: "advanced", label: "Negociação avançada" },
  { id: "closing", label: "Fechamento" },
] as const;

function signalItems(lead: NegotiationLead) {
  return [
    lead.customerSentPdf ? "Cliente enviou PDF" : null,
    lead.customerSentImage ? "Cliente enviou imagem" : null,
    lead.status === "quote_sent" ? "Proposta enviada" : null,
    lead.statusBehindAi ? "A IA indica uma etapa à frente do CRM" : null,
    lead.ai.risk ? `Risco identificado: ${lead.ai.risk}` : null,
    ...lead.ai.buyingSignals,
    ...lead.ai.objections.map((objection) => `Objeção: ${objection}`),
  ].filter((item): item is string => Boolean(item));
}

export function NegotiationLeadSignals({ lead }: { lead: NegotiationLead }) {
  const matchingStage = TRAIL.find(({ id }) => id === lead.level)?.id;
  const signals = signalItems(lead);

  return (
    <div className={styles.leadSignals}>
      <section className={styles.miniTrail} aria-label="Etapas comerciais">
        <ol>
          {TRAIL.map((stage) => (
            <li key={stage.id} data-current={matchingStage === stage.id || undefined} aria-current={matchingStage === stage.id ? "step" : undefined}>
              <span>{stage.label}</span>
            </li>
          ))}
        </ol>
        {!matchingStage ? <p>Nível atual: {LEVEL_LABELS[lead.level]}</p> : null}
      </section>
      <section className={styles.drawerSection} aria-labelledby="negotiation-signals-title">
        <h3 className={styles.drawerTitle} id="negotiation-signals-title">Sinais deste atendimento</h3>
        <ul className={styles.signalList}>
          <li>Etapa no CRM: {LEAD_STATUS_LABELS[lead.status] ?? lead.status}</li>
          <li>Leitura da IA: {stageLabel[lead.ai.conversationStage] ?? "Em análise"}</li>
          <li>Intenção: {intentLabel[lead.ai.customerIntent] ?? "Pendente"}</li>
          {signals.map((signal, index) => <li key={`${index}-${signal}`}>{signal}</li>)}
          {!signals.length ? <li>Sem sinal adicional registrado.</li> : null}
        </ul>
      </section>
    </div>
  );
}
