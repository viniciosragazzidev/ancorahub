import { describe, expect, it } from "vitest";

import { canEnsureLeadHolder, canManagementRegisterSale } from "./register-sale-access";

const lead = { corretorId: "broker-1", branchId: "b1", status: "documentation_pending" };

describe("canManagementRegisterSale", () => {
  it("lets the director register a broker's lead", () => {
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead })).toBe(true);
  });
  it("lets the manager register only inside the unit", () => {
    expect(canManagementRegisterSale({ role: "manager", userId: "m1", branchId: "b1", lead })).toBe(true);
    expect(canManagementRegisterSale({ role: "manager", userId: "m1", branchId: "b2", lead })).toBe(false);
    expect(canManagementRegisterSale({ role: "manager", userId: "m1", branchId: null, lead: { ...lead, branchId: null } })).toBe(false);
  });
  it("leaves brokers, supervisors, own leads and finished leads out", () => {
    expect(canManagementRegisterSale({ role: "broker", userId: "b9", branchId: "b1", lead })).toBe(false);
    expect(canManagementRegisterSale({ role: "supervisor", userId: "s1", branchId: "b1", lead })).toBe(false);
    expect(canManagementRegisterSale({ role: "director", userId: "broker-1", branchId: null, lead })).toBe(false);
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead: { ...lead, corretorId: null } })).toBe(false);
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead: { ...lead, status: "converted" } })).toBe(false);
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead: { ...lead, status: "lost" } })).toBe(false);
  });
  it("lets management complete a sale the IA converted (10/11)", () => {
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead: { ...lead, status: "converted" }, aiSalePending: true })).toBe(true);
    expect(canManagementRegisterSale({ role: "director", userId: "d1", branchId: null, lead: { ...lead, status: "lost" }, aiSalePending: true })).toBe(false);
  });
});

describe("canEnsureLeadHolder", () => {
  it("allows the owner and management roles only inside the resolved lead scope", () => {
    expect(canEnsureLeadHolder({ role: "broker", userId: "broker-1", lead, isInScope: true })).toBe(true);
    expect(canEnsureLeadHolder({ role: "broker", userId: "other", lead, isInScope: true })).toBe(false);
    for (const role of ["director", "manager", "supervisor"]) {
      expect(canEnsureLeadHolder({ role, userId: "manager-1", lead, isInScope: true })).toBe(true);
      expect(canEnsureLeadHolder({ role, userId: "manager-1", lead, isInScope: false })).toBe(false);
    }
    expect(canEnsureLeadHolder({ role: "finance", userId: "finance-1", lead, isInScope: true })).toBe(false);
  });
});
