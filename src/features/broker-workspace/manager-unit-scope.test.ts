import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { getManagerUnitScope } from "./manager-unit-scope";

const base: TenantContext = { userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" };

describe("manager Lite unit scope", () => {
  it("returns tenant and authenticated branch together", () => {
    expect(getManagerUnitScope(base)).toEqual({ tenantId: "tenant-1", branchId: "branch-1" });
  });
  it("fails closed when the manager has no unit or another role", () => {
    expect(getManagerUnitScope({ ...base, branchId: null })).toBeNull();
    expect(getManagerUnitScope({ ...base, role: "director" })).toBeNull();
  });
});
