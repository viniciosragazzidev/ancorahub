"use client";

/**
 * Pós-venda por corretor (24/11): uma linha por corretor com pesquisas no período. Clique abre o painel com os
 * leads dele e a situação de cada pesquisa; clicar num lead troca o painel para a conversa.
 */
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { postSaleRuleLabel } from "@/features/post-sale-audit/auto-rules";
import { sortPostSaleSurveys, type BrokerBreakdown, type PostSaleSurveyRow } from "@/features/post-sale-audit/overview";

import { PostSaleChips, PostSaleStageBadge } from "./post-sale-lead-panel";
import styles from "./post-sale.module.css";

const fmt = (value: number) => value.toLocaleString("pt-BR");

const COLUMNS: LiteColumn<BrokerBreakdown>[] = [
  { id: "broker", label: "Corretor", primary: true, nowrap: true, render: (row) => <span className={page.cellTitle}>{row.brokerName}</span> },
  { id: "leads", label: "Leads", numeric: true, render: (row) => fmt(row.leads) },
  { id: "sent", label: "Enviadas", numeric: true, render: (row) => fmt(row.sent) },
  { id: "responded", label: "Respondidas", numeric: true, render: (row) => <span>{fmt(row.responded)}{row.responseRate !== null ? <span className={page.muted}> · {row.responseRate}%</span> : null}</span> },
  { id: "rating", label: "Nota", numeric: true, render: (row) => row.averageRating === null ? <span className={page.muted}>Sem nota</span> : `${row.averageRating.toLocaleString("pt-BR")}/5` },
  {
    id: "contacted",
    label: "Falou com o cliente?",
    render: (row) => row.contactedAnswered
      ? <span className={page.badge}>{row.contactedPercent}% sim · {row.contactedYes} de {row.contactedAnswered}</span>
      : <span className={page.muted}>Sem resposta</span>,
  },
  {
    id: "alerts",
    label: "Alertas",
    render: (row) => row.openAlerts || row.noContact
      ? <span className={styles.chips}>
        {row.openAlerts ? <span className={page.badge} data-tone="danger">{row.openAlerts} {row.openAlerts === 1 ? "aberto" : "abertos"}</span> : null}
        {row.noContact ? <span className={page.badge} data-tone="warning">{row.noContact} sem contato</span> : null}
      </span>
      : <span className={page.muted}>Nenhum</span>,
  },
];

export function PostSaleBrokers({ brokers, onOpen }: { brokers: BrokerBreakdown[]; onOpen: (broker: BrokerBreakdown) => void }) {
  return (
    <section className={page.group} aria-labelledby="pos-venda-corretores">
      <div className={page.cardHead}>
        <h2 id="pos-venda-corretores" className={page.sectionTitle}>Por corretor</h2>
        <p className={page.muted}>Quem tem alerta aberto aparece primeiro. Clique para ver os leads do corretor.</p>
      </div>
      <LiteResponsiveData
        caption="Pós-venda por corretor"
        columns={COLUMNS}
        rows={brokers}
        rowKey={(row) => row.brokerId}
        onRowOpen={onOpen}
        empty={<p className={page.muted}>Nenhum corretor com pesquisa no período.</p>}
      />
    </section>
  );
}

/** Painel do corretor: resumo em uma linha e a lista dos leads dele, cada um abre a conversa. */
export function PostSaleBrokerPanel({ broker, rows, onOpenLead }: { broker: BrokerBreakdown; rows: PostSaleSurveyRow[]; onOpenLead: (row: PostSaleSurveyRow) => void }) {
  const sorted = sortPostSaleSurveys(rows);
  return (
    <div className={styles.panel}>
      <dl className={styles.facts}>
        <dt>Enviadas</dt><dd>{fmt(broker.sent)}</dd>
        <dt>Respondidas</dt><dd>{fmt(broker.responded)}{broker.responseRate !== null ? ` (${broker.responseRate}%)` : ""}</dd>
        <dt>Nota média</dt><dd>{broker.averageRating === null ? "Sem nota" : `${broker.averageRating.toLocaleString("pt-BR")}/5`}</dd>
        <dt>Falou com o cliente</dt><dd>{broker.contactedAnswered ? `${broker.contactedYes} de ${broker.contactedAnswered} disseram sim` : "Sem resposta a essa pergunta"}</dd>
        <dt>Alertas abertos</dt><dd>{fmt(broker.openAlerts)}</dd>
        {broker.failed ? <><dt>Não saíram</dt><dd>{fmt(broker.failed)}</dd></> : null}
      </dl>
      <section className={page.group} aria-label={`Leads de ${broker.brokerName}`}>
        <h3 className={page.sectionTitle}>Leads ({fmt(sorted.length)})</h3>
        <ul className={styles.leadRows}>
          {sorted.map((row) => (
            <li key={row.id}>
              <button type="button" className={styles.leadRow} onClick={() => onOpenLead(row)}>
                <span style={{ minWidth: 0 }}>
                  <span className={page.cellTitle}>{row.leadName}</span>
                  <span className={page.cellSub}>{postSaleRuleLabel(row.ruleKey)}{row.alertOpen ? " · alerta aberto" : ""}</span>
                  {row.lastReplyAt ? <PostSaleChips row={row} limit={3} /> : null}
                </span>
                <PostSaleStageBadge row={row} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
