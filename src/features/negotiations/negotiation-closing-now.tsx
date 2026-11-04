"use client";

import type { CSSProperties } from "react";

import { LiteStagger } from "@/components/lite/motion";
import { formatAgo } from "@/components/lite/status/format";
import { peopleHue, peopleInitials } from "@/components/light/people-list/people-list";

import type { NegotiationLead } from "./queries";
import styles from "./negotiations.module.css";

const MAX_VISIBLE = 6;

/** Quem está em fechamento, do que entrou na etapa há mais tempo para o mais recente: os primeiros pedem atenção. */
function closingLeads(leads: readonly NegotiationLead[]) {
  return leads
    .filter((lead) => lead.level === "closing")
    .sort((left, right) => (left.stageEnteredAt ? new Date(left.stageEnteredAt).getTime() : Infinity) - (right.stageEnteredAt ? new Date(right.stageEnteredAt).getTime() : Infinity));
}

export function NegotiationClosingNow({ leads, generatedAt, onOpen, onShowAll }: {
  leads: readonly NegotiationLead[];
  generatedAt: Date;
  onOpen: (lead: NegotiationLead) => void;
  onShowAll: () => void;
}) {
  const closing = closingLeads(leads);
  if (!closing.length) return null;
  const visible = closing.slice(0, MAX_VISIBLE);

  return (
    <section className={styles.closingNow} aria-labelledby="closing-now-title">
      <div className={styles.closingHead}>
        <h2 className={styles.closingTitle} id="closing-now-title">
          <span className={styles.liveDot} aria-hidden="true" />
          Em fechamento agora
          <span className={styles.closingCount}>{closing.length}</span>
        </h2>
        {closing.length > MAX_VISIBLE ? <button type="button" className={styles.closingAll} onClick={onShowAll}>Ver todos</button> : null}
      </div>
      <LiteStagger className={styles.closingList}>
        {visible.map((lead) => {
          const since = lead.stageEnteredAt ? formatAgo(generatedAt.getTime() - new Date(lead.stageEnteredAt).getTime()) : null;
          return (
            <button key={lead.id} type="button" className={styles.closingItem} aria-label={`Abrir ${lead.name}, em fechamento`} onClick={() => onOpen(lead)}>
              <span className={styles.closingAvatar} style={{ "--hue": peopleHue(lead.name) } as CSSProperties} aria-hidden="true">{peopleInitials(lead.name)}</span>
              <span className={styles.closingMain}>
                <span className={styles.closingName}>{lead.name}</span>
                <span className={styles.closingMeta}>{lead.brokerName}{since ? ` · na etapa ${since}` : ""}</span>
              </span>
              {lead.customerWaiting ? <span className={styles.closingWaiting} role="img" aria-label="Cliente aguarda resposta" title="Cliente aguarda resposta" /> : null}
            </button>
          );
        })}
      </LiteStagger>
    </section>
  );
}
