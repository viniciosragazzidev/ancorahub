import { describe, expect, it } from "vitest";

import type { SupervisorWorkspaceData } from "./queries";
import { buildSupervisorNowItems } from "./now-items";

const now = new Date("2026-10-17T10:00:00-03:00");

const workspace: SupervisorWorkspaceData = {
  viewer: { userId: "supervisor-1", tenantId: "tenant-1", name: "Ana Supervisor", branchName: "Centro" },
  teamIdentity: null,
  team: [],
  freeBrokers: [],
  duty: [{ assignmentId: "assignment-1", brokerId: "broker-1", brokerName: "Bruno Lima", scheduleName: "PRESENCIAL TARDE", startsAt: "13:00", endsAt: "18:00", paused: false, presence: "pending" }],
  goal: null,
  today: { receivedToday: 2, inService: 1, waiting: 1, late: 1 },
  attention: [
    { leadId: "new-1", name: "Lead recente", brokerId: "broker-1", brokerName: "Bruno Lima", assignedAt: new Date("2026-10-17T09:55:00-03:00"), late: false },
    { leadId: "old-1", name: "Lead antigo", brokerId: "broker-1", brokerName: "Bruno Lima", assignedAt: new Date("2026-10-16T09:55:00-03:00"), late: false },
    { leadId: "late-1", name: "Lead atrasado", brokerId: "broker-1", brokerName: "Bruno Lima", assignedAt: new Date("2026-10-17T09:30:00-03:00"), late: true },
  ],
  unreadNotifications: 0,
  latestNotificationTitle: null,
  slaMinutes: 15,
  updatedAt: now,
};

describe("buildSupervisorNowItems", () => {
  it("surfaces an unconfirmed shift before confirmed people", () => {
    const data: SupervisorWorkspaceData = {
      ...workspace,
      attention: [],
      duty: [
        { assignmentId: "confirmed", brokerId: "broker-1", brokerName: "Ana Lima", scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", paused: false, presence: "confirmed" },
        { assignmentId: "pending", brokerId: "broker-2", brokerName: "Bia Souza", scheduleName: "Tarde", startsAt: "13:00", endsAt: "18:00", paused: false, presence: "pending" },
      ],
    };

    expect(buildSupervisorNowItems(data, now)[0]?.detail).toContain("não confirmou presença");
  });

  it("shows today's arrivals, overdue first contact and an unconfirmed duty with one action each", () => {
    const items = buildSupervisorNowItems(workspace, now);
    expect(items.map((item) => item.id)).toEqual(["new-new-1", "late-late-1", "duty-assignment-1"]);
    expect(items[0]).toMatchObject({ actionLabel: "Repassar", href: "/equipe/repassar?lead=new-1" });
    expect(items[1]).toMatchObject({ actionLabel: "Cobrar Bruno", href: "/relacionamento?brokerId=broker-1&leadId=late-1&action=reminder" });
    expect(items[2]).toMatchObject({ actionLabel: "Ver plantão", href: "/plantoes/corretor/broker-1" });
    expect(items[2]?.detail).toContain("não confirmou presença");
  });
});
