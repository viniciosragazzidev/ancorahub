"use client";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { LiteDataTable, type LiteColumn } from "@/components/lite/data/data";
import type { ClosingOutcomeBrokerRow, ClosingOutcomesSummary } from "@/features/leads/closing-outcome-core";

import { formatNegotiationMetric } from "./negotiations-data-views";
import styles from "./negotiations.module.css";

const BROKER_COLUMNS: LiteColumn<ClosingOutcomeBrokerRow>[] = [
  { id: "broker", label: "Corretor", primary: true, nowrap: true, render: (row) => <span title={row.brokerName}><BrokerProfileLink brokerId={row.brokerId} name={row.brokerName} /></span> },
  { id: "inClosing", label: "Em fechamento", numeric: true, render: (row) => formatNegotiationMetric(row.inClosing) },
  { id: "pending", label: "Pendentes", numeric: true, render: (row) => formatNegotiationMetric(row.pending) },
  { id: "converted", label: "Fechou", numeric: true, render: (row) => formatNegotiationMetric(row.converted) },
  { id: "lost", label: "Perdeu", numeric: true, render: (row) => formatNegotiationMetric(row.lost) },
];

/**
 * Desfechos do fechamento (09/11): o que aconteceu com quem entrou em Documentação ou Em análise no período
 * e quantos estão parados sem resposta agora ("desfecho pendente", mais de 10 dias sem mudar de etapa).
 */
export function NegotiationClosingOutcomes({ summary }: { summary: ClosingOutcomesSummary }) {
  const stats = [
    { id: "entered", label: "Entraram no fechamento", value: summary.entered },
    { id: "converted", label: "Fechou", value: summary.converted },
    { id: "lost", label: "Perdeu", value: summary.lost },
    { id: "returned", label: "Voltou de etapa", value: summary.returned },
    { id: "pending", label: "Desfecho pendente agora", value: summary.pendingNow },
  ];
  return (
    <section className={styles.outcomes} aria-labelledby="closing-outcomes-title">
      <div className={styles.closingHead}>
        <h2 className={styles.closingTitle} id="closing-outcomes-title">Desfechos do fechamento</h2>
        <p className={styles.outcomesPeriod}>Últimos {summary.periodDays} dias · {formatNegotiationMetric(summary.inClosingNow)} em fechamento agora</p>
      </div>
      <dl className={styles.outcomesStats}>
        {stats.map((stat) => (
          <div key={stat.id} className={styles.outcomesStat} data-tone={stat.id === "pending" && stat.value > 0 ? "warning" : undefined}>
            <dt className={styles.outcomesLabel}>{stat.label}</dt>
            <dd className={styles.outcomesValue}>{formatNegotiationMetric(stat.value)}</dd>
          </div>
        ))}
      </dl>
      {summary.pendingNow > 0 ? (
        <p className={styles.outcomesHint}>Pendente é quem está no fechamento há mais de 10 dias sem mudar de etapa. O corretor responde no próprio lead: Fechou, Perdeu ou Continua em análise.</p>
      ) : null}
      <LiteDataTable
        caption="Desfechos do fechamento por corretor"
        columns={BROKER_COLUMNS}
        rows={summary.brokers}
        rowKey={(row) => row.brokerId ?? "sem-corretor"}
        rowTone={(row) => (row.pending > 0 ? "warning" : undefined)}
        empty={<p>Nenhum lead entrou ou saiu do fechamento no período.</p>}
      />
    </section>
  );
}
