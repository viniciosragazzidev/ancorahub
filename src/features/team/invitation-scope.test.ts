import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { canRevokeTeamInvitation } from "./invitation-scope";

const manager: TenantContext = { userId: "manager-1", tenantId: "tenant-a", role: "manager", jobTitle: "manager", branchId: "unit-a" };
const supervisor: TenantContext = { userId: "supervisor-1", tenantId: "tenant-a", role: "supervisor", jobTitle: "supervisor", branchId: "unit-a", supervisorTeamScope: true };

describe("team invitation scope", () => {
  it("allows a manager to revoke only an invitation for their unit", () => {
    expect(canRevokeTeamInvitation(manager, { userId: null, role: "broker", branchId: "unit-a", supervisorId: null })).toBe(true);
    expect(canRevokeTeamInvitation(manager, { userId: null, role: "broker", branchId: "unit-b", supervisorId: null })).toBe(false);
    expect(canRevokeTeamInvitation(manager, { userId: null, role: "director", branchId: "unit-a", supervisorId: null })).toBe(false);
  });

  it("allows a supervisor only for a broker with their supervisorId", () => {
    expect(canRevokeTeamInvitation(supervisor, { userId: "broker-a", role: "broker", branchId: "unit-a", supervisorId: "supervisor-1" })).toBe(true);
    expect(canRevokeTeamInvitation(supervisor, { userId: "broker-b", role: "broker", branchId: "unit-a", supervisorId: "supervisor-2" })).toBe(false);
    expect(canRevokeTeamInvitation(supervisor, { userId: null, role: "broker", branchId: "unit-a", supervisorId: null })).toBe(false);
  });
});
