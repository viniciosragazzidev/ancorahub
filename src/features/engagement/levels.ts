import type { JourneyDayFacts, JourneyLevel, JourneyLevelProgress, JourneyStreak } from "./journey-types";

export const JOURNEY_LEVELS: readonly JourneyLevel[] = [
  { index: 0, name: "Iniciante", threshold: 0 },
  { index: 1, name: "Consultor", threshold: 500 },
  { index: 2, name: "Especialista", threshold: 2_000 },
  { index: 3, name: "Referência", threshold: 6_000 },
  { index: 4, name: "Mestre", threshold: 15_000 },
];
export function evaluateLevel(points: number): JourneyLevelProgress {
  const totalPoints = Math.max(0, Number.isFinite(points) ? Math.floor(points) : 0);
  const level = [...JOURNEY_LEVELS].reverse().find((l) => totalPoints >= l.threshold)!;
  const nextLevel = JOURNEY_LEVELS[level.index + 1] ?? null;
  return { level, nextLevel, totalPoints, pointsInLevel: totalPoints - level.threshold,
    pointsToNext: nextLevel ? nextLevel.threshold - totalPoints : 0,
    percentage: nextLevel ? Math.min(100, Math.floor(100 * (totalPoints - level.threshold) / (nextLevel.threshold - level.threshold))) : 100 };
}
export const levelOf = evaluateLevel;
/** Only closed duty days count. An unfinished current day cannot break a streak. */
export function evaluateStreak(days: readonly JourneyDayFacts[], today: string): JourneyStreak {
  let current = 0, best = 0;
  let lastDutyDate: string | null = null;
  const unique = new Map(days.map((day) => [day.date, day]));
  for (const day of [...unique.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!day.hasDuty || day.date >= today) continue;
    lastDutyDate = day.date;
    current = day.slaBreaches === 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return { current, best, lastDutyDate };
}
