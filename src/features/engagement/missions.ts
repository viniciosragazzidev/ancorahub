import type { JourneyDayFacts, JourneyMission, MissionBonus, MissionProgress } from "./journey-types";
import { journeyDay, journeyMidnight, journeyWeek, shiftJourneyDay } from "./journey-periods";

export function defaultJourneyMissions(tenantId: string): JourneyMission[] {
  const rows: [string, string, JourneyMission["metric"], number, number, JourneyMission["period"]][] = [
    ["fast-contact", "Todo primeiro contato em até 5 min", "contacts.fast_coverage", 1, 20, "daily"],
    ["returns", "Zerar retornos vencidos", "returns.cleared", 1, 10, "daily"],
    ["notes", "Registrar cada atendimento", "notes.coverage", 1, 10, "daily"],
    ["steps", "Registrar a etapa dos leads aceitos", "steps.coverage", 1, 10, "daily"],
    ["offers", "Aceitar toda oferta em até 1 min", "offers.fast_coverage", 1, 10, "daily"],
    ["contact-days", "5 dias com contato no prazo", "contacts.days_on_time", 5, 40, "weekly"],
    ["contacts", "20 primeiros contatos com evidência", "contacts.evidenced", 20, 40, "weekly"],
  ];
  return rows.map(([key, title, metric, target, bonusPoints, period]) => ({
    id: `journey:${tenantId}:${key}`, kind: period === "daily" ? "daily" : "weekly", title, description: "",
    metric, target, bonusPoints, period, audience: {}, startsAt: null, endsAt: null, status: "active",
  }));
}
export type MissionSubject = { brokerId: string; branchId: string | null; supervisorId: string | null; dutyScheduleIds: string[] };
export function missionMatches(mission: JourneyMission, subject: MissionSubject, now: Date): boolean {
  if (mission.status !== "active" || (mission.startsAt && now < new Date(mission.startsAt)) || (mission.endsAt && now >= new Date(mission.endsAt))) return false;
  const a = mission.audience;
  return (!a.userIds?.length || a.userIds.includes(subject.brokerId))
    && (!a.branchIds?.length || Boolean(subject.branchId && a.branchIds.includes(subject.branchId)))
    && (!a.supervisorIds?.length || Boolean(subject.supervisorId && a.supervisorIds.includes(subject.supervisorId)))
    && (!a.dutyScheduleIds?.length || subject.dutyScheduleIds.some((id) => a.dutyScheduleIds!.includes(id)));
}
export function selectDailyMissions(missions: readonly JourneyMission[], hasDuty: boolean): JourneyMission[] {
  return missions.filter((m) => m.period !== "daily" || (hasDuty
    ? m.metric !== "returns.cleared"
    : m.metric !== "contacts.fast_coverage" && m.metric !== "offers.fast_coverage"));
}
export function evaluateMission(input: { mission: JourneyMission; subject: MissionSubject; days: readonly JourneyDayFacts[]; now: Date; date?: string; previousCompletedAt?: string | null }): MissionProgress {
  const { mission, subject, now } = input;
  const today = journeyDay(now);
  const date = input.date ?? today;
  const week = journeyWeek(new Date(`${date}T12:00:00Z`));
  const periodKey = mission.period === "daily" ? date : mission.period === "weekly" ? week.periodKey : mission.startsAt ?? mission.id;
  const days = [...new Map(input.days.map((d) => [d.date, d])).values()].filter((d) => d.date <= date && (mission.period === "daily" ? d.date === date : mission.period === "weekly" ? d.date >= week.startsAt && d.date < week.endsAt : (!mission.startsAt || d.date >= journeyDay(new Date(mission.startsAt))) && (!mission.endsAt || d.date <= journeyDay(new Date(mission.endsAt)))));
  const sum = (key: keyof JourneyDayFacts) => days.reduce((total, d) => total + Number(d[key] ?? 0), 0);
  // A completed campaign is evaluated once after its end, against its final instant.
  const eligibilityAt = mission.endsAt && now >= new Date(mission.endsAt) ? new Date(new Date(mission.endsAt).getTime() - 1) : now;
  let progress = 0, target = mission.target, eligible = missionMatches(mission, subject, eligibilityAt);
  // Coverage and zero-backlog bonuses are finalized after the day closes.
  // Otherwise a later offer/contact could invalidate an already paid "all" bonus.
  let closedRequired = false;
  switch (mission.metric) {
    case "contacts.fast_coverage": target = sum("receivedLeads"); progress = sum("fastContacts"); closedRequired = true; break;
    case "offers.fast_coverage": target = sum("offers"); progress = sum("fastAcceptedOffers"); closedRequired = true; break;
    case "notes.coverage": target = sum("serviceLeads"); progress = sum("validNotes"); closedRequired = true; break;
    case "steps.coverage": target = sum("stageEligibleLeads"); progress = sum("stagedLeads"); closedRequired = true; break;
    // No return due that day: nothing to clear, so the mission does not apply (it used to show "0 de 1").
    case "returns.cleared": target = sum("returnsDue"); progress = sum("overdueReturns") === 0 ? sum("returnsDue") : Math.max(0, target - sum("overdueReturns")); closedRequired = true; break;
    case "contacts.days_on_time": progress = days.filter((d) => d.onTimeContacts > 0).length; break;
    case "contacts.evidenced": progress = sum("evidencedContacts"); break;
    case "contacts.on_time": progress = sum("onTimeContacts"); break;
    case "sla.no_breach": progress = days.filter((d) => d.date < today && d.receivedLeads > 0 && d.slaBreaches === 0).length; break;
  }
  eligible = eligible && target > 0;
  let closed = mission.period === "daily" ? date < today : mission.period === "weekly" ? week.endsAt <= today : Boolean(mission.endsAt && new Date(mission.endsAt) <= now);
  // The last assignment of a day must reach the same 30-minute eligibility as the rest.
  if (mission.metric === "steps.coverage" && mission.period === "daily") closed = now.getTime() >= journeyMidnight(shiftJourneyDay(date, 1)).getTime() + 30 * 60_000;
  const completed = Boolean(input.previousCompletedAt) || (eligible && progress >= target && (!closedRequired || closed));
  return { missionId: mission.id, subjectId: subject.brokerId, periodKey, progress, target: Math.max(1, target),
    percentage: target > 0 ? Math.min(100, Math.floor(progress * 100 / target)) : 0, remaining: Math.max(0, target - progress),
    eligible, completed, completedAt: input.previousCompletedAt ?? (completed ? now.toISOString() : null) };
}
export function missionBonus(mission: JourneyMission, progress: MissionProgress): MissionBonus | null {
  if (!progress.completed || !progress.completedAt || mission.bonusPoints <= 0) return null;
  return { brokerId: progress.subjectId, missionId: mission.id, periodKey: progress.periodKey, points: mission.bonusPoints,
    occurredAt: progress.completedAt, idempotencyKey: `mission:${mission.id}:${progress.subjectId}:${progress.periodKey}` };
}
