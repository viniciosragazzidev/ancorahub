"use client";

import { useMemo, type CSSProperties } from "react";

import { formatNegotiationMetric } from "./negotiations-data-views";
import { buildClosingHistoryView, shapeClosingLeads, type ClosingSnapshotLead, type NegotiationSnapshotHistoryRow } from "./negotiation-snapshot-model";
import type { NegotiationLead } from "./queries";
import styles from "./negotiations.module.css";

function dayLabel(day: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit" }).format(new Date(`${day}T12:00:00.000Z`));
}

function MoveList({ title, leads, empty }: { title: string; leads: readonly ClosingSnapshotLead[]; empty: string }) {
  return (
    <div className={styles.historyMove}>
      <h3 className={styles.historyMoveTitle}>{title} <span className={styles.closingCount}>{leads.length}</span></h3>
      {leads.length ? (
        <ul className={styles.historyMoveList}>
          {leads.map((lead) => (
            <li key={lead.leadId}><span className={styles.closingName}>{lead.name}</span><span className={styles.closingMeta}> · {lead.brokerName}</span></li>
          ))}
        </ul>
      ) : <p className={styles.closingHint}>{empty}</p>}
    </div>
  );
}

/**
 * Foto diária do Fechamento (09/11, só o diretor): quantos estavam em Fechamento no fim de cada um dos últimos
 * 7 dias, mais o número de agora, e quem entrou e quem saiu desde a última foto. Sem foto ainda (tabela nova
 * ou job ainda não rodou), não aparece.
 */
export function NegotiationClosingHistory({ history, leads, generatedAt, branchId }: {
  history: readonly NegotiationSnapshotHistoryRow[];
  leads: readonly NegotiationLead[];
  generatedAt: Date;
  branchId: string | null;
}) {
  const live = useMemo(() => shapeClosingLeads(leads), [leads]);
  const view = useMemo(() => buildClosingHistoryView({ snapshots: history, liveClosing: live, now: generatedAt, branchId }), [history, live, generatedAt, branchId]);
  if (!view.days.length) return null;
  const liveCount = branchId ? live.filter((lead) => lead.branchId === branchId).length : live.length;
  const peak = Math.max(1, liveCount, ...view.days.map((day) => day.count));

  return (
    <section className={styles.history} aria-labelledby="closing-history-title">
      <div className={styles.closingHead}>
        <h2 className={styles.closingTitle} id="closing-history-title">Fechamento nos últimos dias</h2>
        <p className={styles.outcomesPeriod}>Foto das 23:55 de cada dia</p>
      </div>
      <ol className={styles.historyDays} aria-label="Leads em fechamento por dia">
        {view.days.map((day) => (
          <li key={day.day} className={styles.historyDay} style={{ "--bar": `${Math.round((day.count / peak) * 100)}%` } as CSSProperties}>
            <span className={styles.historyBar} aria-hidden="true" />
            <span className={styles.historyValue}>{formatNegotiationMetric(day.count)}</span>
            <span className={styles.historyLabel}>{dayLabel(day.day)}</span>
          </li>
        ))}
        <li className={styles.historyDay} data-now="true" style={{ "--bar": `${Math.round((liveCount / peak) * 100)}%` } as CSSProperties}>
          <span className={styles.historyBar} aria-hidden="true" />
          <span className={styles.historyValue}>{formatNegotiationMetric(liveCount)}</span>
          <span className={styles.historyLabel}>agora</span>
        </li>
      </ol>
      {view.baselineDay ? (
        <details className={styles.historyDiff}>
          <summary className={styles.historySummary}>
            Desde a foto de {dayLabel(view.baselineDay)}: {view.entered.length} {view.entered.length === 1 ? "entrou" : "entraram"} e {view.left.length} {view.left.length === 1 ? "saiu" : "saíram"}
          </summary>
          <div className={styles.historyMoves}>
            <MoveList title="Entraram" leads={view.entered} empty="Ninguém entrou no fechamento." />
            <MoveList title="Saíram" leads={view.left} empty="Ninguém saiu do fechamento." />
          </div>
        </details>
      ) : null}
    </section>
  );
}
