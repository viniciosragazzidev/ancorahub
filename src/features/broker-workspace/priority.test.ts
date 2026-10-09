import { describe, expect, it } from "vitest";

import { prioritizeBrokerWorkspace, resolveSlaFirstContactState, type BrokerWorkspacePriorityLead, type BrokerWorkspacePriorityTask } from "./priority";

const now = new Date("2026-08-03T12:00:00.000Z");

function lead(overrides: Partial<BrokerWorkspacePriorityLead> = {}): BrokerWorkspacePriorityLead {
  return {
    id: "lead-a",
    name: "Pessoa sintética",
    status: "in_contact",
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    assignedAt: new Date("2026-08-03T10:00:00.000Z"),
    firstContactAt: new Date("2026-08-03T10:05:00.000Z"),
    stageEnteredAt: new Date("2026-08-03T10:00:00.000Z"),
    lastIncomingAt: null,
    hasPendingQuote: false,
    pendingDocumentCount: 0,
    ...overrides,
  };
}

function task(overrides: Partial<BrokerWorkspacePriorityTask> = {}): BrokerWorkspacePriorityTask {
  return {
    id: "task-a",
    leadId: "lead-a",
    title: "Retornar contato",
    dueAt: new Date("2026-08-03T13:00:00.000Z"),
    priority: "normal",
    createdAt: now,
    ...overrides,
  };
}

describe("prioritizeBrokerWorkspace", () => {
  it("prioritizes a customer awaiting response above every other operational item", () => {
    const result = prioritizeBrokerWorkspace({
      now,
      slaFirstContactMinutes: 15,
      leads: [lead({ lastIncomingAt: new Date("2026-08-03T11:58:00.000Z"), firstContactAt: null, assignedAt: new Date("2026-08-03T10:00:00.000Z") })],
      tasks: [task({ dueAt: new Date("2026-08-03T11:00:00.000Z") })],
    });

    expect(result[0]).toMatchObject({ kind: "awaiting_response", href: "/leads/lead-a" });
  });

  it("orders overdue SLA before overdue tasks and respects the deadline in ties", () => {
    const result = prioritizeBrokerWorkspace({
      now,
      slaFirstContactMinutes: 15,
      leads: [
        lead({ id: "lead-sla", firstContactAt: null, assignedAt: new Date("2026-08-03T10:00:00.000Z") }),
        lead({ id: "lead-task", name: "Outra pessoa" }),
      ],
      tasks: [task({ id: "task-late", leadId: "lead-task", dueAt: new Date("2026-08-03T11:00:00.000Z") })],
    });

    expect(result.slice(0, 2).map((item) => item.kind)).toEqual(["sla_overdue", "task_overdue"]);
  });

  it("uses a stable lead id tie-breaker for equal priorities", () => {
    const result = prioritizeBrokerWorkspace({
      now,
      slaFirstContactMinutes: 15,
      leads: [
        lead({ id: "lead-b", status: "new", createdAt: now }),
        lead({ id: "lead-a", status: "new", createdAt: now }),
      ],
      tasks: [],
    });

    expect(result.filter((item) => item.kind === "new_lead").map((item) => item.leadId)).toEqual(["lead-a", "lead-b"]);
  });
});

describe("resolveSlaFirstContactState", () => {
  const sla = 15;
  const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60 * 1000);

  it("is overdue after the deadline, at risk inside the last window and null otherwise", () => {
    expect(resolveSlaFirstContactState({ firstContactAt: null, assignedAt: at(20), slaFirstContactMinutes: sla, now })?.state).toBe("overdue");
    expect(resolveSlaFirstContactState({ firstContactAt: null, assignedAt: at(10), slaFirstContactMinutes: sla, now })?.state).toBe("risk");
    expect(resolveSlaFirstContactState({ firstContactAt: null, assignedAt: at(1), slaFirstContactMinutes: 60, now })).toBeNull();
  });

  it("ignores leads that already had a first contact or have no assignment date", () => {
    expect(resolveSlaFirstContactState({ firstContactAt: at(5), assignedAt: at(20), slaFirstContactMinutes: sla, now })).toBeNull();
    expect(resolveSlaFirstContactState({ firstContactAt: null, assignedAt: null, slaFirstContactMinutes: sla, now })).toBeNull();
  });

  it("agrees with the priority queue about which leads are overdue or at risk", () => {
    for (const minutesAgo of [1, 5, 10, 13, 15, 16, 40]) {
      const candidate = lead({ status: "in_contact", firstContactAt: null, assignedAt: at(minutesAgo), createdAt: at(minutesAgo) });
      const queue = prioritizeBrokerWorkspace({ leads: [candidate], tasks: [], now, slaFirstContactMinutes: sla });
      const fromQueue = queue.some((item) => item.kind === "sla_overdue" || item.kind === "sla_risk");
      const fromHelper = resolveSlaFirstContactState({ firstContactAt: null, assignedAt: candidate.assignedAt, slaFirstContactMinutes: sla, now }) !== null;
      expect(fromHelper, `${minutesAgo} min`).toBe(fromQueue);
    }
  });
});
