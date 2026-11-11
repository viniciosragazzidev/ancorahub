/**
 * Resumo do modo sombra da prioridade por tipo de plantão (puro, para o script
 * scripts/plantao-priority-shadow-report.ts e para os testes).
 * Entrada: o `plantaoPriority` gravado no metadata de cada offer_sent.
 */
export type PlantaoPriorityShadowRow = {
  baselineTypeId: string | null;
  chosenTypeId: string | null;
  changed: boolean;
  /** Temperatura do lead na hora da escolha (gravada no metadata). */
  temperature: string | null;
};

export type PlantaoPriorityShadowSummary = {
  total: number;
  changed: number;
  changedPct: number;
  types: Array<{
    typeId: string;
    baseline: number;
    weighted: number;
    baselineSharePct: number;
    weightedSharePct: number;
    /** Variação em pontos percentuais (ponderada − hoje). */
    deltaPoints: number;
    /** Variação relativa do volume do tipo (para o critério "nenhum plantão perde > 15%"). */
    deltaRelativePct: number | null;
  }>;
};

const NO_TYPE = "(sem tipo)";

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

export function summarizePlantaoPriorityShadow(rows: readonly PlantaoPriorityShadowRow[]): PlantaoPriorityShadowSummary {
  const baseline = new Map<string, number>();
  const weighted = new Map<string, number>();
  let changed = 0;
  for (const row of rows) {
    const before = row.baselineTypeId ?? NO_TYPE;
    const after = row.chosenTypeId ?? NO_TYPE;
    baseline.set(before, (baseline.get(before) ?? 0) + 1);
    weighted.set(after, (weighted.get(after) ?? 0) + 1);
    if (row.changed) changed++;
  }
  const total = rows.length;
  const typeIds = [...new Set([...baseline.keys(), ...weighted.keys()])].sort();
  return {
    total,
    changed,
    changedPct: pct(changed, total),
    types: typeIds.map((typeId) => {
      const before = baseline.get(typeId) ?? 0;
      const after = weighted.get(typeId) ?? 0;
      return {
        typeId,
        baseline: before,
        weighted: after,
        baselineSharePct: pct(before, total),
        weightedSharePct: pct(after, total),
        deltaPoints: Math.round((pct(after, total) - pct(before, total)) * 10) / 10,
        deltaRelativePct: before ? Math.round(((after - before) / before) * 1000) / 10 : null,
      };
    }),
  };
}

export function readPlantaoPriorityShadowRow(metadata: unknown): PlantaoPriorityShadowRow | null {
  if (!metadata || typeof metadata !== "object") return null;
  const priority = (metadata as Record<string, unknown>).plantaoPriority;
  if (!priority || typeof priority !== "object") return null;
  const raw = priority as Record<string, unknown>;
  return {
    baselineTypeId: typeof raw.baselineTypeId === "string" ? raw.baselineTypeId : null,
    chosenTypeId: typeof raw.chosenTypeId === "string" ? raw.chosenTypeId : null,
    changed: raw.changed === true,
    temperature: typeof raw.temperature === "string" ? raw.temperature : null,
  };
}
