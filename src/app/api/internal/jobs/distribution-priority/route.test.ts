import { beforeEach, describe, expect, it, vi } from "vitest";

const runPriority = vi.hoisted(() => vi.fn(async () => ({ leads: 2, offered: 2 })));

vi.mock("@/shared/db/background-pool", () => ({ backgroundRoute: (handler: unknown) => handler }));
vi.mock("@/features/live-status/heartbeat", () => ({ withJobHeartbeat: (_name: string, handler: unknown) => handler }));
vi.mock("@/features/lead-distribution/jobs", () => ({ runPriorityLeadDistribution: runPriority }));

import { GET } from "./route";

const call = (authorization?: string) => (GET as unknown as (request: Request) => Promise<Response>)(
  new Request("http://localhost/api/internal/jobs/distribution-priority", { headers: authorization ? { authorization } : {} }),
);

beforeEach(() => {
  runPriority.mockClear();
  process.env.CRON_SECRET = "secret";
});

describe("job de quentes e mornos a cada minuto (06/11)", () => {
  it("runs only the priority pass", async () => {
    const response = await call("Bearer secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, priority: { leads: 2, offered: 2 } });
    expect(runPriority).toHaveBeenCalledTimes(1);
  });

  it("refuses a call without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect(runPriority).not.toHaveBeenCalled();
  });

  it("answers 500 and frees the guard when the pass fails", async () => {
    runPriority.mockRejectedValueOnce(new Error("db down"));
    expect((await call("Bearer secret")).status).toBe(500);
    expect((await call("Bearer secret")).status).toBe(200);
  });
});
