"use client";

import type { CSSProperties } from "react";

import { LiteStagger } from "@/components/lite/motion";
import { formatAgo } from "@/components/lite/status/format";
import { peopleHue, peopleInitials } from "@/components/light/people-list/people-list";

import type { NegotiationLead } from "./queries";
import styles from "./negotiations.module.css";

const MAX_VISIBLE = 6;

function time(value: string | null) {
  if (!value) return null;
  const at = new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

/**
 * Quem está em fechamento, do cliente que falou por último para o que está quieto há mais tempo. Desde 09/11 o
 * fechamento só acaba com uma negativa do cliente (ou alguém mudando a etapa), então a lista chega a ~90 leads:
 * primeiro quem está se mexendo; quem não falou na janela vem depois, pela entrada mais recente na etapa.
 */
export function sortClosingLeads(leads: readonly NegotiationLead[]) {
  return leads
    .filter((lead) => lead.level === "closing")
    .sort((left, right) => {
      const leftCustomer = time(left.lastCustomerMessageAt);
      const rightCustomer = time(right.lastCustomerMessageAt);
      if (leftCustomer !== rightCustomer) {
        if (leftCustomer === null) return 1;
        if (rightCustomer === null) return -1;
        return rightCustomer - leftCustomer;
      }
      return (time(right.stageEnteredAt) ?? -Infinity) - (time(left.stageEnteredAt) ?? -Infinity);
    });
}

function daysText(days: number | null) {
  if (days === null) return null;
  if (days === 0) return "entrou hoje";
  return days === 1 ? "1 dia na etapa" : `${days} dias na etapa`;
}

/** O sinal mais útil do lead em uma linha: há quanto tempo o cliente falou, ou por que está quieto. */
function activityText(lead: NegotiationLead, now: number) {
  if (lead.noCrmConversation) return "sem conversa no CRM";
  const customerAt = time(lead.lastCustomerMessageAt);
  if (customerAt !== null) return `cliente falou ${formatAgo(now - customerAt)}`;
  return "cliente quieto há 7 dias ou mais";
}

export function NegotiationClosingNow({ leads, generatedAt, onOpen, onShowAll }: {
  leads: readonly NegotiationLead[];
  generatedAt: Date;
  onOpen: (lead: NegotiationLead) => void;
  onShowAll: () => void;
}) {
  const closing = sortClosingLeads(leads);
  if (!closing.length) return null;
  const visible = closing.slice(0, MAX_VISIBLE);
  const now = generatedAt.getTime();

  return (
    <section className={styles.closingNow} aria-labelledby="closing-now-title">
      <div className={styles.closingHead}>
        <h2 className={styles.closingTitle} id="closing-now-title">
          <span className={styles.liveDot} aria-hidden="true" />
          Em fechamento agora
          <span className={styles.closingCount}>{closing.length}</span>
        </h2>
        {closing.length > MAX_VISIBLE ? <button type="button" className={styles.closingAll} onClick={onShowAll}>Ver todos os {closing.length}</button> : null}
      </div>
      <p className={styles.closingHint}>Fica em fechamento até o cliente dizer não ou alguém mudar a etapa. Primeiro quem falou por último.</p>
      <LiteStagger className={styles.closingList}>
        {visible.map((lead) => {
          const meta = [lead.brokerName, daysText(lead.daysAtStage), activityText(lead, now)].filter(Boolean).join(" · ");
          return (
            <button key={lead.id} type="button" className={styles.closingItem} data-quiet={lead.noCrmConversation || lead.exchangeStale || undefined} aria-label={`Abrir ${lead.name}, em fechamento`} onClick={() => onOpen(lead)}>
              <span className={styles.closingAvatar} style={{ "--hue": peopleHue(lead.name) } as CSSProperties} aria-hidden="true">{peopleInitials(lead.name)}</span>
              <span className={styles.closingMain}>
                <span className={styles.closingName}>{lead.name}</span>
                <span className={styles.closingMeta} title={meta}>{meta}</span>
              </span>
              {lead.customerWaiting ? <span className={styles.closingWaiting} role="img" aria-label="Cliente aguarda resposta" title="Cliente aguarda resposta" /> : null}
            </button>
          );
        })}
      </LiteStagger>
    </section>
  );
}
