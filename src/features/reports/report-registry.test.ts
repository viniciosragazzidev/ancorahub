import { describe, expect, it } from "vitest";

import { getReportDefinition, reportRegistry } from "./report-registry";

describe("report registry", () => {
  it("keeps the operational reports available to supervisors", () => {
    expect(reportRegistry).toHaveLength(6);
    expect(reportRegistry.every((report) => report.allowsSupervisor)).toBe(true);
  });

  it("does not resolve an unknown report", () => {
    expect(getReportDefinition("financeiro-global")).toBeUndefined();
  });
});
