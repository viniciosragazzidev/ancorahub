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
    freeBrokers: [{ userId: "b9", name: "Davi Livre" }],
    goal: null,
    duty: [{ brokerId: "b2", brokerName: "Bruno Reis", scheduleName: "PME Tarde", startsAt: "13:30", endsAt: "19:00", paused: false, presence: "pending" }],
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
    expect(threads.map((thread) => thread.assistant)).toEqual(["ancora", "equipe", "equipe-leads", "equipe-plantao", "equipe-desempenho"]);
    expect(threads[1]!.preview).toContain("Ana precisa de você");
    expect(threads[1]!.waitingYou).toBe(true);
    expect(threads[2]!.preview).toContain("1 lead(s) com primeiro contato atrasado");
  });

  it("turns the team's stuck leads into lead threads that open the lead", () => {
    const [lead] = buildSupervisorLeadThreads(data(), now);
    expect(lead).toMatchObject({ href: "/leads/l1", waitingYou: true, initials: "MS" });
    expect(lead!.preview).toContain("Ana · contato atrasado");
  });

  it("a team that was not created points to Minha equipe, never shows other brokers", () => {
    const empty = data({ team: [], attention: [], today: { receivedToday: 0, inService: 0, waiting: 0, late: 0 } });
    expect(buildSupervisorThreads(empty, now)[1]!.preview).toContain("Monte em Minha equipe");
    for (const id of ["equipe", "equipe-leads", "equipe-plantao", "equipe-desempenho"] as const) {
      const script = buildSupervisorScript(id, empty, now);
      expect(script.status?.label).toBe("Sem equipe");
    }
  });

  it("a created team with no broker yet is named and points to adding brokers", () => {
    const created = data({ teamIdentity: { name: "Equipe Horizonte", description: null }, team: [], attention: [], today: { receivedToday: 0, inService: 0, waiting: 0, late: 0 } });
    expect(buildSupervisorThreads(created, now)[1]!.preview).toBe("Equipe Horizonte: ainda sem corretores. Adicione em Minha equipe.");
    const script = buildSupervisorScript("equipe", created, now);
    expect(script.status?.label).toBe("Equipe Horizonte · sem corretores");
    const choice = script.blocks.find((block) => block.type === "question");
    expect(choice && choice.type === "question" ? choice.choices.map((item) => item.label) : null).toEqual(["Abrir Equipe Horizonte", "Adicionar corretores", "Editar a equipe"]);
  });

  it("team script opens each broker's profile and offers a message to the team", () => {
    const script = buildSupervisorScript("equipe", data(), now);
    const list = script.blocks.find((block) => block.type === "list");
    expect(list && list.type === "list" ? list.items.map((item) => item.href) : []).toEqual(["/equipe/b1", "/equipe/b2"]);
    const choice = script.blocks.find((block) => block.id === "equipe-choice");
    expect(choice && choice.type === "question" ? choice.choices.map((item) => item.id) : []).toEqual(["open-needing", "message", "team-page"]);
  });

  it("performance ranks only inside the team", () => {
    const script = buildSupervisorScript("equipe-desempenho", data(), now);
    const bars = script.blocks.find((block) => block.type === "bars");
    expect(bars && bars.type === "bars" ? bars.values.map((value) => value.label) : []).toEqual(["Ana", "Bruno"]);
    const choice = script.blocks.find((block) => block.id === "equipe-desempenho-choice");
    expect(choice && choice.type === "question" ? choice.choices.map((item) => [item.label, item.action]) : []).toContainEqual(["Ver o placar", { kind: "href", href: "/equipe/desempenho" }]);
  });

  it("does not offer to add brokers in the chat (that lives in Minha equipe) and hands off a late lead", () => {
    const team = buildSupervisorScript("equipe", data(), now);
    expect(team.blocks.some((block) => block.id === "equipe-free-choice")).toBe(false);
    const leads = buildSupervisorScript("equipe-leads", data(), now);
    const handoff = leads.blocks.find((block) => block.id === "equipe-leads-handoff");
    expect(handoff && handoff.type === "question" ? handoff.choices[0]!.action : null).toEqual({ kind: "href", href: "/equipe/repassar?lead=l1" });
  });

  it("team duty lists today's plantão with presence and points at who has not confirmed", () => {
    const script = buildSupervisorScript("equipe-plantao", data(), now);
    const list = script.blocks.find((block) => block.type === "list");
    expect(list && list.type === "list" ? list.items[0] : null).toMatchObject({ primary: "Bruno Reis", secondary: "PME Tarde · 13:30 às 19:00", trailing: "esperando confirmar", href: "/equipe/b2" });
    expect(script.status?.label).toBe("Confirmações pendentes");
  });
});
