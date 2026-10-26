import { describe, expect, it } from "vitest";

import { canOpenNegotiations, canViewNegotiationLead } from "./negotiation-scope";

const lead = { tenantId: "t1", branchId: "u1", brokerId: "b1" };

describe("canViewNegotiationLead", () => {
  it("allows director within tenant and rejects cross-tenant records", () => {
    expect(canViewNegotiationLead({ role: "director", tenantId: "t1", branchId: null, supervisorId: null }, lead)).toBe(true);
    expect(canViewNegotiationLead({ role: "director", tenantId: "t2", branchId: null, supervisorId: null }, lead)).toBe(false);
  });

  it("limits managers to their authenticated unit", () => {
    expect(canViewNegotiationLead({ role: "manager", tenantId: "t1", branchId: "u1", supervisorId: null }, lead)).toBe(true);
    expect(canViewNegotiationLead({ role: "manager", tenantId: "t1", branchId: "u2", supervisorId: null }, lead)).toBe(false);
  });

  it("limits supervisors to broker ids in their team", () => {
    const scope = { role: "supervisor" as const, tenantId: "t1", branchId: null, supervisorId: "s1" };
    expect(canViewNegotiationLead(scope, lead, new Set(["b1"]))).toBe(true);
    expect(canViewNegotiationLead(scope, lead, new Set(["b2"]))).toBe(false);
  });

  it("rejects unassigned leads for every role", () => {
    expect(canViewNegotiationLead({ role: "director", tenantId: "t1", branchId: null, supervisorId: null }, { ...lead, brokerId: null })).toBe(false);
  });
});

describe("canOpenNegotiations", () => {
  it.each(["director", "manager", "supervisor"])("%s can open when enabled and permitted", (role) => {
    expect(canOpenNegotiations(role, true, true)).toBe(true);
  });

  it("denies broker, disabled area and missing permission", () => {
    expect(canOpenNegotiations("broker", true, true)).toBe(false);
    expect(canOpenNegotiations("director", false, true)).toBe(false);
    expect(canOpenNegotiations("manager", true, false)).toBe(false);
  });
});
