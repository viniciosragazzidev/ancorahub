import { beforeEach, describe, expect, it, vi } from "vitest";

const publishLeadInvalidation = vi.fn();
const limit = vi.fn();

vi.mock("@/features/leads/publish-lead-invalidation", () => ({ publishLeadInvalidation }));
vi.mock("@/shared/db", () => ({
  schema: { leads: { branchId: "branchId", id: "id", tenantId: "tenantId" } },
  getDatabase: () => ({ select: () => ({ from: () => ({ where: () => ({ limit }) }) }) }),
}));

const { signalLeadOwnershipChange } = await import("./ownership-signal");

describe("lead ownership signal", () => {
  beforeEach(() => {
    publishLeadInvalidation.mockReset();
    limit.mockReset().mockResolvedValue([{ branchId: "unit-a" }]);
  });

  it("signals every affected broker once, plus the lead's unit supervisors", async () => {
    await signalLeadOwnershipChange({ tenantId: "t1", leadId: "l1", brokerIds: ["b-new", null, "b-old", "b-new"] });

    expect(publishLeadInvalidation).toHaveBeenCalledWith({
      tenantId: "t1",
      actorId: "b-new",
      branchIds: ["unit-a"],
      brokerIds: ["b-new", "b-old"],
    });
  });

  it("does nothing when no broker is involved", async () => {
    await signalLeadOwnershipChange({ tenantId: "t1", leadId: "l1", brokerIds: [null, undefined] });
    expect(publishLeadInvalidation).not.toHaveBeenCalled();
  });

  it("never fails the business flow when publishing fails", async () => {
    publishLeadInvalidation.mockRejectedValue(new Error("realtime down"));
    await expect(signalLeadOwnershipChange({ tenantId: "t1", leadId: "l1", brokerIds: ["b1"] })).resolves.toBeUndefined();
  });
});
