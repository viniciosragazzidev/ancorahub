import type { JourneyDayFacts, JourneyMission } from "./journey-types";
import { journeyDay, journeyWeek } from "./journey-periods";

export type TeamMissionEvaluation = {
  periodKey: string;
  progress: number;
  target: number;
  eligible: boolean;
  completed: boolean;
  contributions: Map<string, number>;
};

/** Collective missions use only the same persisted evidence as broker missions. */
export function evaluateTeamMission(input: {
  mission: JourneyMission;
  members: Array<{ brokerId: string; days: readonly JourneyDayFacts[] }>;
  now: Date;
  date?: string;
  previousCompleted: boolean;
}): TeamMissionEvaluation | null {
  const { mission, members, now } = input;
  if (mission.kind !== "team" || !members.length) return null;
  const date = input.date ?? journeyDay(now);
  const contributions = new Map<string, number>();
  if (mission.metric === "contacts.on_time" && mission.period === "weekly") {
    const week = journeyWeek(new Date(`${date}T12:00:00Z`));
    let progress = 0;
    for (const member of members) {
      const contribution = member.days.filter((day) => day.date >= week.startsAt && day.date < week.endsAt && day.date <= date)
        .reduce((sum, day) => sum + day.onTimeContacts, 0);
      contributions.set(member.brokerId, contribution);
      progress += contribution;
    }
    return { periodKey: week.periodKey, progress, target: mission.target, eligible: true, completed: input.previousCompleted || progress >= mission.target, contributions };
  }
  if (mission.metric === "sla.no_breach" && mission.period === "daily") {
    let received = 0;
    let breaches = 0;
    for (const member of members) {
      const facts = member.days.find((day) => day.date === date);
      const memberReceived = facts?.receivedLeads ?? 0;
      const memberBreaches = facts?.slaBreaches ?? 0;
      received += memberReceived;
      breaches += memberBreaches;
      contributions.set(member.brokerId, memberReceived > 0 && memberBreaches === 0 ? 1 : 0);
    }
    const closed = date < journeyDay(now);
    const completed = input.previousCompleted || (closed && received > 0 && breaches === 0);
    return { periodKey: date, progress: completed ? 1 : 0, target: 1, eligible: received > 0 || input.previousCompleted, completed, contributions };
  }
  return null;
}

export function defaultTeamMissions(tenantId: string): JourneyMission[] {
  return [
    { id: `journey:${tenantId}:team:no-sla`, kind: "team", title: "Equipe sem prazo estourado", description: "Feche o dia sem quebra de SLA.", metric: "sla.no_breach", target: 1, bonusPoints: 10, period: "daily", audience: {}, startsAt: null, endsAt: null, status: "active" },
    { id: `journey:${tenantId}:team:on-time-contacts`, kind: "team", title: "30 contatos no prazo", description: "Some os primeiros contatos da equipe feitos dentro do prazo.", metric: "contacts.on_time", target: 30, bonusPoints: 30, period: "weekly", audience: {}, startsAt: null, endsAt: null, status: "active" },
  ];
}
