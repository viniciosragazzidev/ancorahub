import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), snapshot: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/supervisor-workspace/control-queries", () => ({ getSupervisorControlData: mocks.snapshot }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ tenantId: "tenant-a", userId: "supervisor-a", role: "supervisor", branchId: "unit-a", supervisorTeamScope: true });
  mocks.snapshot.mockResolvedValue({ brokers: [], pendencies: [], updatedAt: "2026-11-25T12:00:00.000Z" });
});

it("returns the scoped snapshot without caching", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ brokers: [], pendencies: [] });
  expect(mocks.snapshot).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "supervisor-a", role: "supervisor", branchId: "unit-a", supervisorTeamScope: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it("denies sessions without team access before loading the snapshot", async () => {
  mocks.context.mockRejectedValue(new Error("no session"));
  expect((await GET()).status).toBe(401);
  mocks.context.mockResolvedValue({ tenantId: "tenant-a", userId: "manager-a", role: "manager" });
  expect((await GET()).status).toBe(403);
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

it("denies the snapshot when the Lite gate or team scope is unavailable", async () => {
  mocks.snapshot.mockResolvedValue(null);
  expect((await GET()).status).toBe(403);
});

it("returns a temporary error when the data source is unavailable", async () => {
  mocks.context.mockResolvedValue({ tenantId: "tenant-a", userId: "supervisor-a", role: "supervisor", branchId: "unit-a", supervisorTeamScope: true });
  mocks.snapshot.mockRejectedValue(new Error("database unavailable"));
  expect((await GET()).status).toBe(503);
});
