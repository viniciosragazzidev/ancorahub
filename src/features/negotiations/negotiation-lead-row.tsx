"use client";

import { formatAgo } from "@/components/lite/status/format";
import { PeopleRow } from "@/components/light/people-list/people-list";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";

import type { NegotiationLead } from "./queries";
import styles from "./negotiations.module.css";

/** Sinais concretos do atendimento, como etiquetas curtas (não uma frase corrida). */
export function negotiationSignalTags(lead: NegotiationLead) {
  const tags: string[] = [];
  if (lead.customerSentPdf) tags.push("PDF enviado");
  if (lead.customerSentImage) tags.push("Imagem enviada");
  if (lead.status === "quote_sent") tags.push("Proposta enviada");
  if (lead.statusBehindAi) tags.push("IA indica próxima etapa");
  return tags;
}

export function replyOwedLabel(lead: NegotiationLead) {
  return lead.replyOwedBy === "broker" ? "Aguardando o corretor" : lead.replyOwedBy === "customer" ? "Aguardando o cliente" : "Sem resposta pendente";
}

export function NegotiationLeadRow({ lead, index, generatedAt, onOpen }: {
  lead: NegotiationLead;
  index: number;
  generatedAt: Date;
  onOpen: (lead: NegotiationLead) => void;
}) {
  const stoppedAt = lead.lastExchangeAt ? new Date(lead.lastExchangeAt).getTime() : null;
  const stopped = stoppedAt !== null && Number.isFinite(stoppedAt) ? `Sem troca ${formatAgo(generatedAt.getTime() - stoppedAt)}` : "Sem troca recente";
  const tags = negotiationSignalTags(lead);
  const alert = lead.level === "cooling" || lead.level === "no_crm_conversation";

  return (
    <PeopleRow
      name={lead.name}
      index={index}
      chip={<span className={styles.cardStatus}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status} · {lead.brokerName}</span>}
      preview={(
        <span className={styles.rowPreview}>
          <span className={styles.replyOwed} data-tone={lead.customerWaiting ? "waiting" : alert ? "alert" : undefined}>{replyOwedLabel(lead)}</span>
          {tags.map((tag) => <span key={tag} className={styles.signalTag}>{tag}</span>)}
        </span>
      )}
      meta={<span className={styles.cardStopped}>{stopped}</span>}
      dot={lead.customerWaiting ? "waiting" : alert ? "alert" : null}
      dotLabel={lead.customerWaiting ? "Cliente aguarda resposta" : lead.level === "cooling" ? "Atendimento esfriando" : lead.level === "no_crm_conversation" ? "Sem conversa no CRM" : undefined}
      action={<button type="button" className={styles.cardOpen} aria-label={`Ver detalhes de ${lead.name}`} onClick={() => onOpen(lead)}>Ver detalhes</button>}
    />
  );
}
