import { describe, expect, it } from "vitest";

import { canRemoveLeadAssignment } from "./assignment-domain";

describe("canRemoveLeadAssignment", () => {
  const unstartedAssignedLead = {
    corretorId: "broker-a",
    status: "distributed",
    distributionStatus: "assigned",
    firstContactAt: null,
    serviceStartedAt: null,
    archivedAt: null,
    deletedAt: null,
  };

  it("allows removing an assignment before the broker starts service", () => {
    expect(canRemoveLeadAssignment(unstartedAssignedLead)).toBe(true);
  });

  it("allows removing an assignment after service starts without changing its historical timestamps", () => {
    expect(canRemoveLeadAssignment({
      ...unstartedAssignedLead,
      status: "in_contact",
      firstContactAt: new Date("2026-09-23T10:00:00Z"),
      serviceStartedAt: new Date("2026-09-23T10:00:00Z"),
    })).toBe(true);
  });

  it.each([
    ["sem corretor", { ...unstartedAssignedLead, corretorId: null }],
    ["status perdido", { ...unstartedAssignedLead, status: "lost" }],
    ["status convertido", { ...unstartedAssignedLead, status: "converted" }],
    ["lead arquivado", { ...unstartedAssignedLead, archivedAt: new Date() }],
    ["lead excluído", { ...unstartedAssignedLead, deletedAt: new Date() }],
  ])("blocks removal for %s", (_reason, lead) => {
    expect(canRemoveLeadAssignment(lead)).toBe(false);
  });
});
