import { describe, expect, it } from "vitest";

import { buildDutyNowLeads, selectDutyNowOccurrence } from "./duty-now-domain";

describe("selectDutyNowOccurrence", () => {
  it("uses the requested plantão and does not fall back to another one", () => {
    const running = [{ scheduleId: "pme" }, { scheduleId: "presencial" }];
    expect(selectDutyNowOccurrence(running, "presencial")).toBe(running[1]);
    expect(selectDutyNowOccurrence(running, "upcoming")).toBeNull();
    expect(selectDutyNowOccurrence(running)).toBe(running[0]);
  });
});

describe("buildDutyNowLeads", () => {
  it("keeps only leads distributed during the selected plantão window", () => {
    const active = { startsAt: new Date("2026-10-17T12:00:00-03:00"), endsAt: new Date("2026-10-17T16:00:00-03:00") };
    const leads = buildDutyNowLeads({
      active,
      brokerId: "broker-1",
      now: new Date("2026-10-17T14:00:00-03:00"),
      offers: [
        { leadId: "old-offer", name: "Lead antigo", status: "ACCEPTED", offeredAt: new Date("2026-10-17T11:59:00-03:00"), acceptedAt: new Date("2026-10-17T12:00:00-03:00"), expiresAt: new Date("2026-10-17T12:10:00-03:00"), leadStatus: "in_contact", leadOwner: "broker-1" },
        { leadId: "today-offer", name: "Lead de hoje", status: "PENDING", offeredAt: new Date("2026-10-17T13:15:00-03:00"), acceptedAt: null, expiresAt: new Date("2026-10-17T14:15:00-03:00"), leadStatus: "distributed", leadOwner: "broker-1" },
      ],
      assigned: [
        { leadId: "old-assignment", name: "Atribuição antiga", status: "in_contact", assignedAt: new Date("2026-10-17T11:00:00-03:00") },
        { leadId: "today-assignment", name: "Atribuição de hoje", status: "in_contact", assignedAt: new Date("2026-10-17T15:00:00-03:00") },
        { leadId: "after-window", name: "Outro plantão", status: "in_contact", assignedAt: new Date("2026-10-17T16:00:00-03:00") },
      ],
    });

    expect(leads.map((lead) => lead.leadId)).toEqual(["today-assignment", "today-offer"]);
    expect(leads.every((lead) => lead.at >= active.startsAt && lead.at < active.endsAt)).toBe(true);
  });
});
