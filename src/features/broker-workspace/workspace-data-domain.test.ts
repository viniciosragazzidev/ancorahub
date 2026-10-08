import { describe, expect, it } from "vitest";

import type { BrokerWorkspacePriority } from "./priority";
import { buildBrokerWorkspaceTodayMetrics, getSaoPauloDayBounds, isBrokerReadyToReceive } from "./workspace-data-domain";

describe("broker workspace data domain", () => {
  it("uses Sao Paulo local midnight for the received-today window", () => {
    const { start, end } = getSaoPauloDayBounds(new Date("2026-10-08T02:59:59.999Z"));

    expect(start.toISOString()).toBe("2026-10-07T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });

  it("normalizes aggregate counts and counts unique SLA-risk leads", () => {
    const priorities = [
      { kind: "sla_risk", leadId: "lead-a" },
      { kind: "sla_overdue", leadId: "lead-a" },
      { kind: "sla_overdue", leadId: "lead-b" },
      { kind: "new_lead", leadId: "lead-c" },
    ] as BrokerWorkspacePriority[];

    expect(buildBrokerWorkspaceTodayMetrics({ receivedToday: "12", acceptedToday: 3, inServiceNow: "21.8" }, priorities)).toEqual({
      receivedToday: 12,
      acceptedToday: 3,
      inServiceNow: 21,
      slaAtRiskNow: 2,
    });
  });

  it.each([
    [{ availabilityStatus: "available", paused: false, presenceStatus: "confirmed" }, true],
    [{ availabilityStatus: "available", paused: false, presenceStatus: "not_required" }, true],
    [{ availabilityStatus: "available", paused: false, presenceStatus: "pending" }, false],
    [{ availabilityStatus: "available", paused: true, presenceStatus: "confirmed" }, false],
    [{ availabilityStatus: "paused", paused: false, presenceStatus: "confirmed" }, false],
  ] as const)("derives readiness from availability, pause and presence", (input, expected) => {
    expect(isBrokerReadyToReceive(input)).toBe(expected);
  });
});
