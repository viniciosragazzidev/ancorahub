import { describe, expect, it } from "vitest";
import { defaultLeadFilterPreferences, hasLeadFilterQuery, parseLeadFilterPreferences } from "./lead-filter-preferences";

describe("lead filter preferences", () => {
  it("restores only the supported local preference shape", () => {
    expect(parseLeadFilterPreferences(JSON.stringify({ search: "Ana", pageSize: "50", eligibleCampaigns: true, ignored: "value" })))
      .toEqual({ ...defaultLeadFilterPreferences, search: "Ana", pageSize: "50", eligibleCampaigns: true });
  });

  it("rejects malformed persisted data", () => {
    expect(parseLeadFilterPreferences("not-json")).toBeNull();
  });

  it("keeps explicit URL filters authoritative over local preferences", () => {
    expect(hasLeadFilterQuery(new URLSearchParams("status=new"))).toBe(true);
    expect(hasLeadFilterQuery(new URLSearchParams("attention=unworked"))).toBe(false);
  });
});
