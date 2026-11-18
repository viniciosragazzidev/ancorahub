import { Badge } from "@/components/arc/badge/badge";

import type { Insight } from "@/features/team-management/insights";

import styles from "./team-extras.module.css";

/** Destaques da semana (G4): até três frases do G0, sem número solto. Não aparece sem destaque. */
export function InsightsSection({ insights }: { insights: readonly Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className={`${styles.card} ${styles.insights}`} aria-labelledby="insights-title">
      <h2 id="insights-title">Destaques</h2>
      <ul className={styles.insightList}>
        {insights.map((insight) => (
          <li key={insight.id}>
            <Badge tone={insight.tone === "positive" ? "success" : "warning"} size="sm">{insight.tone === "positive" ? "Bom sinal" : "Atenção"}</Badge>
            <p>{insight.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
