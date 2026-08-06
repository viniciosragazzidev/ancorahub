import { describe, expect, it } from "vitest";

import { prioritizeBrokerWorkspace, type BrokerWorkspacePriorityLead, type BrokerWorkspacePriorityTask } from "./priority";

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

    expect(result[0]).toMatchObject({ kind: "awaiting_response", href: "/conversas?leadId=lead-a" });
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
