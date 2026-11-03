import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({}), schema: {} }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSettings: async () => new Map() }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ processMetaOutboundBatch: vi.fn() }));
vi.mock("@/features/leads/assignment", () => ({ getLocalDutyParts: () => ({ weekday: 1, time: "10:00" }) }));
vi.mock("./service", () => ({ processQueuedLead: vi.fn() }));
vi.mock("./offers", () => ({ expireOutdatedLeadOffers: vi.fn() }));

import { PRIORITY_RETRY_DELAYS_MS, runPriorityLeadDistribution, schedulePriorityDistributionRetries } from "./jobs";

const emptyRun = { seeded: 0, claimed: 0, assigned: 0, offered: 0, outboundMessageIds: [] as string[], deferred: 0, failed: 0, skipped: 0, recoveredLeases: 0, recoveredAssignments: 0 };

function deps(leads: Array<{ id: string; tenantId: string }>) {
  const order: string[] = [];
  return {
    order,
    findLeads: vi.fn(async () => leads),
    expireOffers: vi.fn(async () => { order.push("expire"); return { expired: 0 }; }),
    ensureJob: vi.fn(async ({ leadId }: { leadId: string }) => { order.push(`job:${leadId}`); }),
    processLead: vi.fn(async ({ leadId }: { leadId?: string }) => {
      order.push(`process:${leadId}`);
      return { ...emptyRun, claimed: 1, offered: 1, outboundMessageIds: [`offer-${leadId}`] };
    }),
    sendOffer: vi.fn(async (_tenantId: string, id: string) => { order.push(`send:${id}`); }),
  };
}

// The mocks only cover what the pass calls.
const asDeps = (d: ReturnType<typeof deps>) => d as unknown as Parameters<typeof runPriorityLeadDistribution>[1];

afterEach(() => vi.useRealTimers());

describe("via rápida da distribuição (03/11)", () => {
  it("offers each recently qualified lead right away, sending the offer in the same pass", async () => {
    const d = deps([{ id: "lead-a", tenantId: "t1" }, { id: "lead-b", tenantId: "t1" }]);
    const result = await runPriorityLeadDistribution({}, asDeps(d));

    expect(result).toMatchObject({ leads: 2, claimed: 2, offered: 2, stoppedByBudget: false });
    expect(d.order).toEqual(["expire", "job:lead-a", "process:lead-a", "send:offer-lead-a", "job:lead-b", "process:lead-b", "send:offer-lead-b"]);
    // One lead at a time, without the tenant-wide sweeps of the backlog drain.
    expect(d.processLead).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-a", limit: 1, skipTenantSweeps: true }));
  });

  it("does nothing (not even the offer sweep) when no lead is waiting", async () => {
    const d = deps([]);
    await expect(runPriorityLeadDistribution({}, asDeps(d))).resolves.toMatchObject({ leads: 0 });
    expect(d.expireOffers).not.toHaveBeenCalled();
    expect(d.processLead).not.toHaveBeenCalled();
  });

  it("stops at its own budget so the rest of the run still happens", async () => {
    const d = deps([{ id: "lead-a", tenantId: "t1" }, { id: "lead-b", tenantId: "t1" }]);
    d.processLead.mockImplementation(async ({ leadId }: { leadId?: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ...emptyRun, claimed: 1, outboundMessageIds: [] as string[], deferred: leadId ? 1 : 0 };
    });
    const result = await runPriorityLeadDistribution({ budgetMs: 10 }, asDeps(d));
    expect(result.stoppedByBudget).toBe(true);
    expect(d.processLead).toHaveBeenCalledTimes(1);
  });

  it("retries a lead that found no broker at 1 and 2.5 minutes, inside the 3-minute target", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    schedulePriorityDistributionRetries("t1", "lead-a", PRIORITY_RETRY_DELAYS_MS, run);

    expect(Math.max(...PRIORITY_RETRY_DELAYS_MS)).toBeLessThan(3 * 60_000);
    vi.advanceTimersByTime(59_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledWith({ tenantId: "t1", leadId: "lead-a", limit: 1 });
    vi.advanceTimersByTime(90_000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
