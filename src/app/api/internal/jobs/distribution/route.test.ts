import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);

vi.mock("@/shared/db/background-pool", () => ({ backgroundRoute: (handler: unknown) => handler }));
vi.mock("@/features/live-status/heartbeat", () => ({ withJobHeartbeat: (_name: string, handler: unknown) => handler }));
vi.mock("@/features/lead-distribution/jobs", () => ({
  runPriorityLeadDistribution: vi.fn(async () => { order.push("priority"); return { leads: 1, offered: 1 }; }),
  drainLeadDistributionBacklog: vi.fn(async () => { order.push("drain"); return { claimed: 0 }; }),
}));
vi.mock("@/features/lead-distribution/duty-presence", () => ({ processDutyPresenceReminders: vi.fn(async () => { order.push("duty_presence"); return { enabled: true }; }) }));
vi.mock("@/features/lead-distribution/duty-shift-reminders", () => ({ processDutyShiftReminders: vi.fn(async () => { order.push("duty_shift"); return { enabled: true }; }) }));

import { GET } from "./route";

beforeEach(() => {
  order.length = 0;
  process.env.CRON_SECRET = "secret";
});

describe("job de distribuição: via rápida primeiro (03/11)", () => {
  it("distributes the recently qualified hot/warm leads before the plantão phases and the backlog", async () => {
    const request = new Request("http://localhost/api/internal/jobs/distribution", { headers: { authorization: "Bearer secret" } });
    const response = await (GET as unknown as (request: Request) => Promise<Response>)(request);
    const body = await response.json();

    expect(order).toEqual(["priority", "duty_presence", "duty_shift", "drain"]);
    expect(body).toMatchObject({ success: true, priority: { leads: 1, offered: 1 } });
    expect(body.phaseMs).toHaveProperty("priority");
  });
});
