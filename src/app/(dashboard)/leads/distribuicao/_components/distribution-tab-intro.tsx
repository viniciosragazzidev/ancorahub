/**
 * Topo das abas da Distribuição (refino 14/11/2026, no desenho do Resumo e do Desempenho do Lite): título, uma
 * frase do que a aba resolve e uma faixa de cartões com o estado de cada bloco, para ler a aba sem abrir os
 * painéis. Só leitura; as configurações continuam nos painéis logo abaixo.
 */
import type { ReactNode } from "react";

import styles from "./distribution-tab-intro.module.css";

export type DistributionTabStat = {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral";
  /** Valor em palavra ("Ligada"), num corpo menor que o de número. */
  text?: boolean;
};

export function DistributionTabIntro({ title, lead, stats, actions }: { title: string; lead: string; stats: DistributionTabStat[]; actions?: ReactNode }) {
  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.lead}>{lead}</p>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      <dl className={styles.cards} data-count={stats.length}>
        {stats.map((stat) => (
          <div key={stat.key} className={styles.card} data-tone={stat.tone}>
            <dt className={styles.cardTop}><span className={styles.cardIcon} aria-hidden="true">{stat.icon}</span><span className={styles.cardLabel}>{stat.label}</span></dt>
            <dd className={stat.text ? styles.cardText : styles.cardValue}>{stat.value}</dd>
            {stat.hint ? <dd className={styles.cardHint}>{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
