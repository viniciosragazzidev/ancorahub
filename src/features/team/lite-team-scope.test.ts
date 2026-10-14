import { describe, expect, it } from "vitest";
import type { TenantContext } from "@/shared/auth/types";
import { canManageLiteBroker } from "./lite-team-scope";

const manager: TenantContext = { userId: "manager-1", tenantId: "tenant-a", role: "manager", jobTitle: "manager", branchId: "unit-a" };
const supervisor: TenantContext = { userId: "supervisor-1", tenantId: "tenant-a", role: "supervisor", jobTitle: "supervisor", branchId: "unit-a", supervisorTeamScope: true };
const broker = { role: "broker", branchId: "unit-a", supervisorId: "supervisor-1", userId: "broker-1" };

describe("Lite team management scope", () => {
  it("allows manager access by unit only", () => {
    expect(canManageLiteBroker(manager, broker)).toBe(true);
    expect(canManageLiteBroker(manager, { ...broker, branchId: "unit-b" })).toBe(false);
    expect(canManageLiteBroker(manager, { ...broker, role: "manager" })).toBe(false);
  });
  it("allows supervisor access by their supervisorId, never by unit alone", () => {
    expect(canManageLiteBroker(supervisor, broker)).toBe(true);
    expect(canManageLiteBroker(supervisor, { ...broker, supervisorId: "supervisor-2" })).toBe(false);
    expect(canManageLiteBroker({ ...supervisor, supervisorTeamScope: false }, broker)).toBe(false);
  });
});
