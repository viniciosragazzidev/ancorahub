import { describe, expect, it } from "vitest";

import { isArchivableUnassignedLead } from "./archive-policy";

const base = {
  corretorId: null,
  deletedAt: null,
  archivedAt: null,
};

describe("unassigned lead archive policy", () => {
  it("accepts every lead without a broker", () => {
    expect(isArchivableUnassignedLead(base)).toBe(true);
  });

  it.each([
    ["assigned", { corretorId: "broker-1" }],
    ["deleted", { deletedAt: new Date() }],
    ["already archived", { archivedAt: new Date() }],
  ])("rejects %s leads", (_label, changes) => {
    expect(isArchivableUnassignedLead({ ...base, ...changes })).toBe(false);
  });

});
