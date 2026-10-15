import type { MonthlyDutyPlanView } from "@/features/lead-distribution/monthly-duty-actions";

/** A plantão (one schedule on one date) of a published escala, as the planner view shows it. */
export type PlanOccurrence = MonthlyDutyPlanView["occurrences"][number];

function previousMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

/**
 * The plantão of a date, when it belongs to a PUBLISHED escala: either the escala
 * is published, or the newer draft still carries it as live. Looks at the date's
 * month and the previous one (an escala can run into the next month).
 */
export function findPublishedOccurrence(
  plans: Record<string, MonthlyDutyPlanView | null | undefined>,
  scheduleId: string,
  dutyDate: string,
): { plan: MonthlyDutyPlanView; occurrence: PlanOccurrence } | null {
  const id = `${scheduleId}:${dutyDate}`;
  const monthKey = dutyDate.slice(0, 7);
  for (const key of [monthKey, previousMonth(monthKey)]) {
    const plan = plans[key];
    if (!plan) continue;
    const occurrence = plan.occurrences.find((item) => item.id === id);
    if (!occurrence) continue;
    if (plan.status === "published" || plan.publishedOccurrenceIds.includes(id)) return { plan, occurrence };
  }
  return null;
}
