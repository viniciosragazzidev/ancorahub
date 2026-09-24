import { describe, expect, it } from "vitest";

import { canDirectorMarkLeadInService } from "./director-service-start";

const assigned = { role: "director", corretorId: "broker-1", status: "distributed" };

describe("director marking a lead in service", () => {
  it("allows a director on an assigned lead that has not started", () => {
    expect(canDirectorMarkLeadInService(assigned)).toBe(true);
  });

  it("is exclusive to directors", () => {
    expect(canDirectorMarkLeadInService({ ...assigned, role: "manager" })).toBe(false);
    expect(canDirectorMarkLeadInService({ ...assigned, role: "broker" })).toBe(false);
  });

  it("requires a broker and a lead still awaiting the start", () => {
    expect(canDirectorMarkLeadInService({ ...assigned, corretorId: null })).toBe(false);
    expect(canDirectorMarkLeadInService({ ...assigned, status: "in_contact" })).toBe(false);
    expect(canDirectorMarkLeadInService({ ...assigned, archivedAt: new Date() })).toBe(false);
  });
});
