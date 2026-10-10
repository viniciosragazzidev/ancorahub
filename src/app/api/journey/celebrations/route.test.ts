import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), pending: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/engagement/journey-queries", () => ({ getPendingJourneyCelebrations: mocks.pending }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ tenantId: "tenant-text", userId: "broker-text", role: "broker" }); mocks.pending.mockResolvedValue([]); });
it("only reads the authenticated user's unseen queue and prohibits response caching", async () => {
  const items = [{ id: "event", kind: "points" }]; mocks.pending.mockResolvedValue(items);
  const response = await GET();
  expect(await response.json()).toEqual({ items });
  expect(mocks.pending).toHaveBeenCalledWith("tenant-text", "broker-text");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("returns an empty array when the feature is off or the new table is absent", async () => {
  expect(await (await GET()).json()).toEqual({ items: [] });
  mocks.pending.mockRejectedValue(new Error("missing table"));
  expect(await (await GET()).json()).toEqual({ items: [] });
});
it("does not read data for managers or unauthenticated visitors", async () => {
  mocks.context.mockResolvedValue({ role: "manager" });
  expect((await GET()).status).toBe(403);
  mocks.context.mockRejectedValue(new Error("no session"));
  expect((await GET()).status).toBe(401);
  expect(mocks.pending).not.toHaveBeenCalled();
});
