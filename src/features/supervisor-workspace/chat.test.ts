import { describe, expect, it } from "vitest";

import { buildSupervisorLeadThreads, buildSupervisorScript, buildSupervisorThreads } from "./chat";
import type { SupervisorWorkspaceData } from "./queries";

const now = new Date("2026-10-10T15:00:00-03:00");

function data(overrides: Partial<SupervisorWorkspaceData> = {}): SupervisorWorkspaceData {
  return {
    viewer: { userId: "sup-1", tenantId: "t", name: "Carla Supervisora", branchName: "Central" },
    team: [
      { userId: "b1", name: "Ana Lima", availability: "available", inService: 3, waiting: 1, late: 1, receivedToday: 2, stats: { brokerId: "b1", offered: 6, accepted: 5, medianAcceptSeconds: 40, started: 4 }, ranks: [{ key: "accepted", position: 1, total: 2 }] },
      { userId: "b2", name: "Bruno Reis", availability: "paused", inService: 1, waiting: 0, late: 0, receivedToday: 0, stats: { brokerId: "b2", offered: 4, accepted: 2, medianAcceptSeconds: 120, started: 2 }, ranks: [{ key: "accepted", position: 2, total: 2 }] },
    ],
    today: { receivedToday: 2, inService: 4, waiting: 1, late: 1 },
    attention: [{ leadId: "l1", name: "Maria Souza", brokerName: "Ana Lima", assignedAt: new Date("2026-10-10T14:20:00-03:00"), late: true }],
    unreadNotifications: 0,
    latestNotificationTitle: null,
    slaMinutes: 15,
    updatedAt: now,
    ...overrides,
  };
}

describe("supervisor Lite chat", () => {
  it("lists the team assistants with who needs the supervisor first", () => {
    const threads = buildSupervisorThreads(data(), now);
    expect(threads.map((thread) => thread.assistant)).toEqual(["ancora", "equipe", "equipe-leads", "equipe-desempenho"]);
    expect(threads[1]!.preview).toContain("Ana precisa de você");
    expect(threads[1]!.waitingYou).toBe(true);
    expect(threads[2]!.preview).toContain("1 lead(s) com primeiro contato atrasado");
  });

  it("turns the team's stuck leads into lead threads that open the lead", () => {
    const [lead] = buildSupervisorLeadThreads(data(), now);
    expect(lead).toMatchObject({ href: "/leads/l1", waitingYou: true, initials: "MS" });
    expect(lead!.preview).toContain("Ana · contato atrasado");
  });

  it("an empty team says to ask the manager, never shows other brokers", () => {
    const empty = data({ team: [], attention: [], today: { receivedToday: 0, inService: 0, waiting: 0, late: 0 } });
    expect(buildSupervisorThreads(empty, now)[1]!.preview).toContain("Peça ao gestor");
    for (const id of ["equipe", "equipe-leads", "equipe-desempenho"] as const) {
      const script = buildSupervisorScript(id, empty, now);
      expect(script.status?.label).toBe("Sem equipe");
    }
  });

  it("team script opens each broker's profile and offers a message to the team", () => {
    const script = buildSupervisorScript("equipe", data(), now);
    const list = script.blocks.find((block) => block.type === "list");
    expect(list && list.type === "list" ? list.items.map((item) => item.href) : []).toEqual(["/equipe/b1", "/equipe/b2"]);
    const choice = script.blocks.find((block) => block.type === "question");
    expect(choice && choice.type === "question" ? choice.choices.map((item) => item.id) : []).toEqual(["open-needing", "message", "team-page"]);
  });

  it("performance ranks only inside the team", () => {
    const script = buildSupervisorScript("equipe-desempenho", data(), now);
    const bars = script.blocks.find((block) => block.type === "bars");
    expect(bars && bars.type === "bars" ? bars.values.map((value) => value.label) : []).toEqual(["Ana", "Bruno"]);
  });
});
