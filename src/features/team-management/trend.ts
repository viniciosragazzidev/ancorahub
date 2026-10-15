export type TrendDirection = "up" | "flat" | "down";

export type MetricTrend = {
  /** Favorable movement: up means improved, down means worsened. */
  direction: TrendDirection;
  /** Actual numeric movement, independent of which direction is favorable. */
  movement: TrendDirection;
  changePercent: number | null;
};

export function compareTrend(input: {
  current: number | null | undefined;
  previous: number | null | undefined;
  higherIsBetter: boolean;
  flatTolerance?: number;
}): MetricTrend {
  const { current, previous, higherIsBetter } = input;
  const tolerance = input.flatTolerance ?? 0.05;
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { direction: "flat", movement: "flat", changePercent: null };
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("A tolerância de tendência deve ser um número não negativo.");

  const delta = current - previous;
  const movement: TrendDirection = delta === 0 || (previous !== 0 && Math.abs(delta / Math.abs(previous)) <= tolerance)
    ? "flat"
    : delta > 0 ? "up" : "down";
  const direction = higherIsBetter || movement === "flat"
    ? movement
    : movement === "up" ? "down" : "up";
  const changePercent = previous === 0 ? (current === 0 ? 0 : null) : (delta / Math.abs(previous)) * 100;
  return { direction, movement, changePercent };
}
