import { describe, expect, it } from "vitest";
import { defaultTeamMissions, evaluateTeamMission } from "./team-missions";
import type { JourneyDayFacts } from "./journey-types";

const day = (date: string, patch: Partial<JourneyDayFacts> = {}): JourneyDayFacts => ({ date, hasDuty: false, receivedLeads: 0, evidencedContacts: 0, fastContacts: 0, onTimeContacts: 0, offers: 0, fastAcceptedOffers: 0, serviceLeads: 0, validNotes: 0, returnsDue: 0, returnsCompletedOnTime: 0, overdueReturns: 0, slaBreaches: 0, confirmedPresence: false, ...patch });

describe("collective journey missions", () => {
  it("aggregates on-time contacts and retains per-broker contributions", () => {
    const mission = defaultTeamMissions("t")[1];
    const result = evaluateTeamMission({ mission, now: new Date("2026-10-14T12:00:00Z"), members: [
      { brokerId: "a", days: [day("2026-10-12", { onTimeContacts: 18 })] },
      { brokerId: "b", days: [day("2026-10-13", { onTimeContacts: 12 })] },
    ], previousCompleted: false });
    expect(result).toMatchObject({ progress: 30, target: 30, completed: true, periodKey: "2026-10-12" });
    expect(result?.contributions.get("a")).toBe(18);
  });

  it("only completes the daily SLA mission after a closed day with no breaches", () => {
    const mission = defaultTeamMissions("t")[0];
    const members = [{ brokerId: "a", days: [day("2026-10-13", { receivedLeads: 2 })] }, { brokerId: "b", days: [day("2026-10-13", { receivedLeads: 1 })] }];
    expect(evaluateTeamMission({ mission, now: new Date("2026-10-14T12:00:00Z"), date: "2026-10-13", members, previousCompleted: false })?.completed).toBe(true);
    const breached = [{ ...members[0], days: [day("2026-10-13", { receivedLeads: 2, slaBreaches: 1 })] }, members[1]];
    expect(evaluateTeamMission({ mission, now: new Date("2026-10-14T12:00:00Z"), date: "2026-10-13", members: breached, previousCompleted: false })?.completed).toBe(false);
  });
});
