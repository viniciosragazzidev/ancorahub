"use client";

/**
 * Topo das abas da Distribuição (refino 14/11/2026, no desenho do Resumo e do Desempenho do Lite): título, uma
 * frase do que a aba resolve e cartões com o estado de cada bloco. Cartão com `panel` vira botão: abre a
 * configuração daquele bloco logo abaixo dos cartões (um por vez). O conteúdo principal da aba (`children`)
 * fica sempre à vista. Assim a aba abre só com o essencial, como pede a regra de densidade.
 */
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
  /** Configuração do bloco: o cartão abre e fecha este painel. */
  panel?: ReactNode;
};

export function DistributionTabIntro({ title, lead, stats, actions, children }: {
  title: string;
  lead: string;
  stats: DistributionTabStat[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const panelId = useId();
  const open = stats.find((stat) => stat.key === openKey && stat.panel);

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
        {stats.map((stat) => {
          const body = (
            <>
              <dt className={styles.cardTop}><span className={styles.cardIcon} aria-hidden="true">{stat.icon}</span><span className={styles.cardLabel}>{stat.label}</span></dt>
              <dd className={stat.text ? styles.cardText : styles.cardValue}>{typeof stat.value === "number" ? stat.value.toLocaleString("pt-BR") : stat.value}</dd>
              {stat.hint ? <dd className={styles.cardHint}>{stat.hint}</dd> : null}
            </>
          );
          if (!stat.panel) return <div key={stat.key} className={styles.card} data-tone={stat.tone}>{body}</div>;
          const isOpen = openKey === stat.key;
          return (
            <div key={stat.key} className={styles.card} data-tone={stat.tone} data-open={isOpen ? "true" : undefined}>
              {body}
              <dd className={styles.cardFoot}>
                <button type="button" className={styles.toggle} aria-expanded={isOpen} aria-controls={panelId}
                  onClick={() => setOpenKey(isOpen ? null : stat.key)}>
                  {isOpen ? "Fechar" : "Ajustar"}
                  <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
                </button>
              </dd>
            </div>
          );
        })}
      </dl>
      <div id={panelId} className={styles.panel} hidden={!open}>{open ? open.panel : null}</div>
      {children}
    </div>
  );
}
