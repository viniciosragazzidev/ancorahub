import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { formatBrokerCents, type BrokerFinanceSummary } from "../broker-finance-core";
import styles from "./broker-finance.module.css";

/**
 * Atalho "Meu financeiro" no Início do corretor: uma faixa só, com o valor a receber, que leva à tela completa.
 * Sem resumo (chave desligada, módulo financeiro inativo ou sem permissão) não desenha nada.
 */
export function BrokerFinanceSummaryCard({ summary }: { summary: BrokerFinanceSummary | null }) {
  if (!summary) return null;
  const receivable = summary.receivableCents === null ? "Ver comissões e repasses" : `${formatBrokerCents(summary.receivableCents)} a receber`;
  return (
    <Link href="/meu-financeiro" className={`${styles.shortcut} ${styles.enter}`} aria-label={`Meu financeiro: ${receivable}`}>
      <span className={styles.shortcutIcon} aria-hidden="true"><Wallet strokeWidth={1.9} /></span>
      <span className={styles.shortcutText}>
        <span className={styles.shortcutTitle}>Meu financeiro</span>
        <span className={styles.shortcutValue}>{receivable}</span>
      </span>
      <ChevronRight className={styles.shortcutChevron} aria-hidden="true" />
    </Link>
  );
}
