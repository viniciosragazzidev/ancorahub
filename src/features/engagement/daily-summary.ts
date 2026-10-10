import { JOURNEY_TIME_ZONE, type JourneyCelebrationPayload, type JourneyDayFacts } from "./journey-types";
import { journeyDay } from "./journey-periods";

const hour = new Intl.DateTimeFormat("en-US", { timeZone: JOURNEY_TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
export function isJourneySummaryDue(now: Date): boolean {
  return Number(hour.format(now)) >= 19;
}
export function dailyJourneySummary(input: { brokerId: string; days: readonly JourneyDayFacts[]; points: number; now: Date }): { key: string; payload: Extract<JourneyCelebrationPayload, { kind: "daily_summary" }> } | null {
  if (!isJourneySummaryDue(input.now)) return null;
  const date = journeyDay(input.now);
  const day = input.days.find((d) => d.date === date);
  if (!day) return null;
  return { key: `daily_summary:${input.brokerId}:${date}`, payload: { kind: "daily_summary", date, received: day.receivedLeads, onTimeContacts: day.onTimeContacts, points: input.points } };
}
