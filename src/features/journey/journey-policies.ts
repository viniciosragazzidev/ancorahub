/** The weekly recognition ceiling counts every grant, including later reversals. */
export function canGrantRecognition(usedThisWeek: number, requested: number) {
  return Number.isInteger(usedThisWeek) && Number.isInteger(requested) && usedThisWeek >= 0 && requested >= 5 && requested <= 50 && usedThisWeek + requested <= 100;
}

/** A z-score needs a real cohort and a non-zero spread. */
export function journeyZScore(values: readonly number[], value: number) {
  if (values.length < 3 || values.some((entry) => !Number.isFinite(entry)) || !Number.isFinite(value)) return 0;
  const mean = values.reduce((sum, entry) => sum + entry, 0) / values.length;
  const variance = values.reduce((sum, entry) => sum + (entry - mean) ** 2, 0) / values.length;
  if (variance === 0) return 0;
  return Math.round(((value - mean) / Math.sqrt(variance)) * 100) / 100;
}
