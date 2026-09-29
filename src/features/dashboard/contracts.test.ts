import { describe, expect, it } from "vitest";
import { resolveDashboardProfile } from "./contracts";

describe("dashboard contract", () => {
  it("resolves the operational priority by role", () => {
    expect(resolveDashboardProfile({ role: "director" }).primarySectionId).toBe("unit-health");
    expect(resolveDashboardProfile({ role: "manager" }).attentionTitle).toContain("unidade");
    expect(resolveDashboardProfile({ role: "supervisor" }).primarySectionId).toBe("team-priorities");
    expect(resolveDashboardProfile({ role: "broker" }).primarySectionId).toBe("next-work");
  });

  it("keeps the global dashboard capped at four metrics", () => {
    expect(resolveDashboardProfile({ role: "director" }).maxMetrics).toBe(4);
  });
});
