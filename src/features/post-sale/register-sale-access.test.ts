import { describe, expect, it } from "vitest";

import { canManagementRegisterSale } from "./register-sale-access";

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
});
