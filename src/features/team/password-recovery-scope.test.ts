import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { canGenerateMemberPasswordReset } from "./password-recovery-scope";

const manager: TenantContext = { userId: "manager-1", tenantId: "tenant-a", role: "manager", jobTitle: "manager", branchId: "unit-a" };
const director: TenantContext = { userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null };

describe("team password reset scope", () => {
  it("rejects a target from another tenant because it has no tenant membership", () => {
    expect(canGenerateMemberPasswordReset(manager, { tenantId: "tenant-b", userId: "external", role: "broker", branchId: "unit-a" })).toBe(false);
  });

  it("rejects another unit and management roles for a manager", () => {
    expect(canGenerateMemberPasswordReset(manager, { tenantId: "tenant-a", userId: "broker", role: "broker", branchId: "unit-b" })).toBe(false);
    expect(canGenerateMemberPasswordReset(manager, { tenantId: "tenant-a", userId: "director", role: "director", branchId: "unit-a" })).toBe(false);
    expect(canGenerateMemberPasswordReset(manager, { tenantId: "tenant-a", userId: "manager-2", role: "manager", branchId: "unit-a" })).toBe(false);
  });

  it("allows an in-unit broker and keeps director tenant access", () => {
    expect(canGenerateMemberPasswordReset(manager, { tenantId: "tenant-a", userId: "broker", role: "broker", branchId: "unit-a" })).toBe(true);
    expect(canGenerateMemberPasswordReset(director, { tenantId: "tenant-a", userId: "broker", role: "broker", branchId: "unit-b" })).toBe(true);
  });
});
