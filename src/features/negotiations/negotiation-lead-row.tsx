"use client";

import { formatAgo } from "@/components/lite/status/format";
import { PeopleRow } from "@/components/light/people-list/people-list";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import type { NegotiationLead } from "./queries";
import { LEVEL_LABELS } from "./negotiations-data-views";
import styles from "./negotiations.module.css";

function stageSignals(lead: NegotiationLead) {
  const signals: string[] = [];
  if (lead.customerSentPdf) signals.push("PDF enviado");
  if (lead.customerSentImage) signals.push("Imagem enviada");
  if (lead.status === "quote_sent") signals.push("Proposta enviada");
  if (lead.statusBehindAi) signals.push("IA indica próxima etapa");
  return signals;
}

export function NegotiationLeadRow({ lead, index, generatedAt, onOpen }: {
  lead: NegotiationLead;
  index: number;
  generatedAt: Date;
  onOpen: (lead: NegotiationLead) => void;
}) {
  const stoppedAt = lead.lastExchangeAt ? new Date(lead.lastExchangeAt).getTime() : null;
  const stopped = stoppedAt !== null && Number.isFinite(stoppedAt) ? formatAgo(generatedAt.getTime() - stoppedAt) : "Sem troca recente";
  const signals = stageSignals(lead);
  const replyLabel = lead.replyOwedBy === "broker" ? "Aguardando o corretor" : lead.replyOwedBy === "customer" ? "Aguardando o cliente" : "Sem resposta pendente";
  const preview = [replyLabel, ...signals].join(" · ");
  const stageStatus = LEAD_STATUS_LABELS[lead.status] ?? lead.status;

  return (
    <PeopleRow
      name={lead.name}
      index={index}
      chip={<span className={styles.cardStage}><span className={styles.level} data-level={lead.level}>{LEVEL_LABELS[lead.level]}</span><span className={styles.cardStatus}>{stageStatus}</span></span>}
      preview={preview}
      previewTone={lead.customerWaiting ? "waiting" : lead.level === "cooling" || lead.level === "no_crm_conversation" ? "alert" : "muted"}
      meta={<span className={styles.cardStopped} aria-label={`Sem troca ${stopped}`}>{stopped}</span>}
      dot={lead.customerWaiting ? "waiting" : lead.level === "cooling" || lead.level === "no_crm_conversation" ? "alert" : null}
      dotLabel={lead.customerWaiting ? "Cliente aguarda resposta" : lead.level === "cooling" ? "Atendimento esfriando" : lead.level === "no_crm_conversation" ? "Sem conversa no CRM" : undefined}
      action={<button type="button" className={styles.cardOpen} aria-label={`Ver detalhes de ${lead.name}`} onClick={() => onOpen(lead)}>Ver detalhes</button>}
    />
  );
}
