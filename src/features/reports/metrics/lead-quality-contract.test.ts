import { describe, expect, it } from "vitest";

import { parseLeadQualityFocus } from "./lead-quality-contract";

describe("parseLeadQualityFocus", () => {
  it("accepts only known dimensions and trims a bounded key", () => {
    expect(parseLeadQualityFocus("campaign", "  cmp-123  ")).toEqual({ dimension: "campaign", key: "cmp-123" });
    expect(parseLeadQualityFocus("unknown_sql", "x")).toBeNull();
    expect(parseLeadQualityFocus("ad", "x".repeat(161))).toBeNull();
    expect(parseLeadQualityFocus(["ad"], "id")).toBeNull();
  });

  it("validates weekday/hour cells instead of accepting arbitrary query values", () => {
    expect(parseLeadQualityFocus("hour", "1:9")).toEqual({ dimension: "hour", key: "1:9" });
    expect(parseLeadQualityFocus("hour", "6:23")).toEqual({ dimension: "hour", key: "6:23" });
    expect(parseLeadQualityFocus("hour", "7:9")).toBeNull();
    expect(parseLeadQualityFocus("hour", "1:24")).toBeNull();
    expect(parseLeadQualityFocus("hour", "1:09;drop table leads")).toBeNull();
  });

  it("rejects empty filters but keeps the explicit unknown bucket", () => {
    expect(parseLeadQualityFocus("city", "  ")).toBeNull();
    expect(parseLeadQualityFocus("city", "__unknown__")).toEqual({ dimension: "city", key: "__unknown__" });
  });
});
