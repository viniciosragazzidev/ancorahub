import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { canAccessManagerUnit, getManagerUnitScope } from "./manager-unit-scope";

const manager: TenantContext = { userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-a" };

describe("manager unit scope", () => {
  it("limits unit routes to the authenticated unit", () => {
    expect(canAccessManagerUnit(manager, "branch-a")).toBe(true);
    expect(canAccessManagerUnit(manager, "branch-b")).toBe(false);
    expect(getManagerUnitScope({ ...manager, branchId: null })).toBeNull();
  });

  it("never derives a unit scope for another role", () => {
    expect(getManagerUnitScope({ ...manager, role: "supervisor" })).toBeNull();
    expect(canAccessManagerUnit({ ...manager, role: "supervisor" }, "branch-a")).toBe(false);
  });
});
