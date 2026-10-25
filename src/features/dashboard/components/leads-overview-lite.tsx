/**
 * Visão geral de leads no visual Lite do diretor: os mesmos quatro números, os mesmos gargalos (cada um leva à lista
 * filtrada) e as mesmas cinco etapas do funil. Grupos com divisórias, sem cartão dentro de cartão.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";

import styles from "./leads-overview-lite.module.css";

export type LeadsOverviewLiteProps = {
  period: number;
  metrics: readonly (readonly [label: string, value: string | number])[];
  attention: readonly { id: string; title: string; description: string; count: number; href: string }[];
  attentionCount: number;
  stages: readonly { stage: string; inStage: number }[];
};

export function LeadsOverviewLite({ period, metrics, attention, attentionCount, stages }: LeadsOverviewLiteProps) {
  const open = attention.filter((item) => item.count > 0);
  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <p className={page.cardDescription}>Saúde da carteira nos últimos {period} dias, dentro do seu escopo.</p>
      <section className={page.stats} aria-label="Indicadores de leads">
        {metrics.map(([label, value], index) => (
          <StatCard key={label} label={label} value={value} animated animationDelay={index * 0.06} />
        ))}
      </section>

      <section className={sections.group} aria-labelledby="leads-overview-attention">
        <div className={sections.row}>
          <h2 id="leads-overview-attention" className={sections.rowTitle}>Gargalos de leads</h2>
        </div>
        {attentionCount ? (
          <ul className={sections.list}>
            {open.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className={styles.rowLink}>
                  <span className={sections.itemText}>
                    <span className={sections.itemTitle}>{item.title}</span>
                    <span className={sections.itemSub}>{item.description}</span>
                  </span>
                  <span className={styles.count}>{item.count}</span>
                  <ChevronRight aria-hidden="true" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.ok}>Nenhum gargalo identificado.</p>
        )}
      </section>

      <section className={sections.group} aria-labelledby="leads-overview-funnel">
        <div className={sections.row}>
          <h2 id="leads-overview-funnel" className={sections.rowTitle}>Funil da carteira</h2>
        </div>
        <dl className={styles.stages}>
          {stages.slice(0, 5).map((row) => (
            <div key={row.stage}>
              <dt>{row.stage}</dt>
              <dd>{row.inStage}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
