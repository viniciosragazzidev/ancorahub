import { InsightStrip } from "@/components/dashboard/insight-strip";

import type { Insight } from "@/features/team-management/insights";

/**
 * Destaques da semana (G4): até três frases do G0, sem número solto. Não aparece sem destaque.
 * Desde 18/11/2026 usa o `InsightStrip` (uma cor só no bloco): o tom vira texto, não selo colorido.
 */
export function InsightsSection({ insights }: { insights: readonly Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <InsightStrip label="Destaques">
      <ul>
        {insights.map((insight) => (
          <li key={insight.id}>
            <span className="font-medium">{insight.tone === "positive" ? "Bom sinal" : "Atenção"}</span>
            <span className="text-muted-foreground"> · </span>
            <span>{insight.message}</span>
          </li>
        ))}
      </ul>
    </InsightStrip>
  );
}
