import { describe, expect, it } from "vitest";

import { isArchivableUnassignedLead } from "./archive-policy";

const base = {
  corretorId: null,
  deletedAt: null,
  archivedAt: null,
  distributionStatus: "queued",
  status: "new",
  qualificationStatus: "qualified",
};

describe("unassigned lead archive policy", () => {
  it("accepts an operational lead without a broker", () => {
    expect(isArchivableUnassignedLead(base)).toBe(true);
  });

  it.each([
    ["assigned", { corretorId: "broker-1" }],
    ["deleted", { deletedAt: new Date() }],
    ["already archived", { archivedAt: new Date() }],
    ["lost", { status: "lost" }],
    ["disqualified", { qualificationStatus: "disqualified" }],
    ["outside inbox", { distributionStatus: "assigned" }],
  ])("rejects %s leads", (_label, changes) => {
    expect(isArchivableUnassignedLead({ ...base, ...changes })).toBe(false);
  });
});

