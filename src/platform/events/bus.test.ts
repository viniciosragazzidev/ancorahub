import { describe, expect, it } from "vitest";

import { createDomainEventBus } from "./bus";

describe("domain event bus", () => {
  it("delivers typed events and isolates handler failures", async () => {
    const bus = createDomainEventBus();
    const received: string[] = [];
    bus.subscribe("lead.created", () => { throw new Error("handler failed"); });
    bus.subscribe("lead.created", (event) => { received.push(event.payload.leadId); });

    const result = await bus.publish({
      name: "lead.created",
      payload: { tenantId: "tenant-a", leadId: "lead-a", occurredAt: new Date().toISOString(), version: 1 },
    });

    expect(received).toEqual(["lead-a"]);
    expect(result.failures).toHaveLength(1);
  });
});
