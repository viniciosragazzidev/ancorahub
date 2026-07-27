import { describe, expect, it } from "vitest";

import {
  createIncomingLeadQueueState,
  enqueueIncomingLead,
  isAssignedLeadNotification,
  resolveIncomingLead,
  type IncomingLead,
} from "./incoming-lead-queue";

const item = (id: string): IncomingLead => ({
  notificationId: id,
  leadId: `lead-${id}`,
  title: "Novo lead atribuído",
  message: "Você recebeu um novo lead para atender.",
  createdAt: new Date().toISOString(),
});

describe("incoming lead queue", () => {
  it("deduplicates notification ids", () => {
    const first = enqueueIncomingLead(createIncomingLeadQueueState(), item("1"));
    const second = enqueueIncomingLead(first, item("1"));
    expect(second.queue).toHaveLength(1);
  });

  it("keeps the newest items within the queue limit", () => {
    let state = createIncomingLeadQueueState();
    for (const id of ["1", "2", "3", "4"]) state = enqueueIncomingLead(state, item(id), 3);
    expect(state.queue.map((entry) => entry.notificationId)).toEqual(["4", "3", "2"]);
  });

  it("promotes the next item after resolve", () => {
    let state = createIncomingLeadQueueState();
    state = enqueueIncomingLead(state, item("1"));
    state = enqueueIncomingLead(state, item("2"));
    state = resolveIncomingLead(state, "2");
    expect(state.queue[0]?.notificationId).toBe("1");
  });

  it("accepts only tenant-scoped assignment notifications", () => {
    const row = { tenant_id: "tenant-1", recipient_user_id: "user-1", type: "agent.lead_assigned", lead_id: "lead-1" };
    expect(isAssignedLeadNotification(row, "tenant-1", "user-1")).toBe(true);
    expect(isAssignedLeadNotification({ ...row, tenant_id: "tenant-2" }, "tenant-1", "user-1")).toBe(false);
    expect(isAssignedLeadNotification({ ...row, type: "sale_registered" }, "tenant-1", "user-1")).toBe(false);
  });
});
