import Link from "next/link";

import { formatBrokerCents, type BrokerFinanceSummary } from "../broker-finance-core";
import styles from "./broker-finance.module.css";

/**
 * Cartão "Meu mês" do corretor: os três números do Meu financeiro, compactos, com o caminho para a tela completa.
 * Sem resumo (chave desligada, módulo financeiro inativo ou sem permissão) não desenha nada.
 */
export function BrokerFinanceSummaryCard({ summary }: { summary: BrokerFinanceSummary | null }) {
  if (!summary) return null;
  const numbers = [
    { label: "A receber", cents: summary.receivableCents },
    { label: "Recebido no mês", cents: summary.receivedThisMonthCents },
    { label: "Adiantamentos em aberto", cents: summary.openAdvancesCents },
  ];
  return (
    <section className={`${styles.card} ${styles.enter}`} aria-labelledby="broker-finance-card-title">
      <div className={styles.cardHead}>
        <h2 id="broker-finance-card-title" className={styles.cardTitle}>Meu mês</h2>
        <span className={styles.cardPeriod}>{summary.periodLabel}</span>
      </div>
      <dl className={styles.cardNumbers}>
        {numbers.map((item) => (
          <div key={item.label} className={styles.cardNumber}>
            <dt>{item.label}</dt>
            <dd data-empty={item.cents === null ? "true" : undefined}>{formatBrokerCents(item.cents)}</dd>
          </div>
        ))}
      </dl>
      <Link href="/meu-financeiro" className={styles.link}>Ver meu financeiro</Link>
    </section>
  );
}
