/**
 * Matemática pura das métricas canônicas (DEC-090).
 *
 * Funções determinísticas e sem I/O: percentuais de coorte, deltas de
 * comparação temporal (pontos percentuais ≠ variação percentual) e
 * progressão do funil canônico de 8 estágios (ADR-001).
 */

export function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function percentage(numerator: number, denominator: number): number {
  return safeRate(numerator, denominator) * 100;
}

export function formatRatePtBR(numerator: number, denominator: number): string {
  return percentage(numerator, denominator).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export interface ComparisonDelta {
  /** Diferença em pontos percentuais — uso exclusivo para taxas. */
  readonly percentagePoints: number | null;
  /** Variação relativa percentual — uso exclusivo para valores absolutos. */
  readonly relativePercent: number | null;
  readonly direction: "up" | "down" | "flat";
}

/**
 * Delta entre janela atual e janela anterior equivalente.
 *
 * `kind` decide a semântica: "rate" retorna pontos percentuais (pp) e nunca
 * variação relativa — evita a estatística enganosa "+12,9%" quando a taxa
 * subiu 2,1 pp (DEC-090 §4).
 */
export function comparisonDelta(
  current: number,
  previous: number | null,
  kind: "rate" | "value",
): ComparisonDelta {
  if (previous === null) {
    return { percentagePoints: null, relativePercent: null, direction: "flat" };
  }

  if (kind === "rate") {
    const pp = current - previous;
    return {
      percentagePoints: Math.round(pp * 10) / 10,
      relativePercent: null,
      direction: pp > 0 ? "up" : pp < 0 ? "down" : "flat",
    };
  }

  if (previous === 0) {
    return {
      percentagePoints: null,
      relativePercent: current > 0 ? 100 : 0,
      direction: current > 0 ? "up" : "flat",
    };
  }

  const relative = ((current - previous) / previous) * 100;
  return {
    percentagePoints: null,
    relativePercent: Math.round(relative * 10) / 10,
    direction: relative > 0 ? "up" : relative < 0 ? "down" : "flat",
  };
}

export function formatDeltaPtBR(delta: ComparisonDelta): string {
  if (delta.percentagePoints !== null) {
    const sign = delta.percentagePoints > 0 ? "+" : "";
    return `${sign}${delta.percentagePoints.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} pp`;
  }
  if (delta.relativePercent !== null) {
    const sign = delta.relativePercent > 0 ? "+" : "";
    return `${sign}${delta.relativePercent.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }
  return "—";
}

/** Estágios ativos do funil canônico, em ordem (ADR-001). `lost` é tratado à parte. */
export const FUNNEL_ACTIVE_STAGES = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "converted",
] as const;

export type FunnelStage = (typeof FUNNEL_ACTIVE_STAGES)[number];

export interface FunnelStageRow {
  readonly stage: FunnelStage;
  /** Leads da coorte cujo status atual está neste estágio. */
  readonly inStage: number;
  /** Leads da coorte que alcançaram este estágio ou posterior (excl. perdidos). */
  readonly reached: number;
  /** Progressão deste estágio para o próximo: reached(next) ÷ reached(stage). */
  readonly progressionToNext: number | null;
}

/**
 * Constrói as linhas do funil a partir da distribuição de status atuais da
 * coorte. Aproximação v1 documentada no plano: usa o status atual como
 * proxy de progressão; transições históricas por evento dependem do
 * PipelineRoot (dívida registrada).
 */
export function buildFunnelRows(
  statusCounts: Readonly<Record<string, number>>,
): { rows: readonly FunnelStageRow[]; lost: number; biggestBottleneck: number | null } {
  const order = (status: string): number => FUNNEL_ACTIVE_STAGES.indexOf(status as FunnelStage);

  const inStage = (stage: FunnelStage) => statusCounts[stage] ?? 0;
  const reached = (stage: FunnelStage) => {
    const target = order(stage);
    let total = 0;
    for (const [status, count] of Object.entries(statusCounts)) {
      if (status === "lost") continue;
      if (order(status) >= target) total += count;
    }
    return total;
  };

  const rows: FunnelStageRow[] = FUNNEL_ACTIVE_STAGES.map((stage, index) => {
    const next = FUNNEL_ACTIVE_STAGES[index + 1];
    return {
      stage,
      inStage: inStage(stage),
      reached: reached(stage),
      progressionToNext: next
        ? reached(next) > 0 || reached(stage) > 0
          ? Math.round((reached(next) / Math.max(reached(stage), 1)) * 100)
          : null
        : null,
    };
  });

  const lost = statusCounts["lost"] ?? 0;

  let biggestBottleneck: number | null = null;
  let worstDrop = 0;
  rows.forEach((row, index) => {
    if (row.progressionToNext === null) return;
    const drop = 100 - row.progressionToNext;
    if (drop > worstDrop) {
      worstDrop = drop;
      biggestBottleneck = index;
    }
  });

  return { rows, lost, biggestBottleneck };
}

/** Início da janela anterior equivalente: mesma duração, imediatamente antes. */
export function previousWindowStart(currentStart: Date, days: number): Date {
  const start = new Date(currentStart);
  start.setDate(start.getDate() - days);
  return start;
}
