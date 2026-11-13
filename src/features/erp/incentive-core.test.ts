import { describe, expect, it } from "vitest";
import { canonicalJson, incentiveCampaignInputSchema, incentiveDigestInput, rankIncentiveFacts, todayInSaoPaulo, visibleRanking, type IncentiveSnapshot } from "./incentive-core";

const fact = (id: string, brokerId: string, at: string, value = 1, branchId: string | null = "u1") => ({ id, brokerId, branchId, at, value });

describe("rankIncentiveFacts", () => {
  it("orders by value, then earlier last fact, then broker id", () => {
    const rows = rankIncentiveFacts([
      fact("s1", "b", "2026-11-02T10:00:00.000000Z"), fact("s2", "b", "2026-11-05T10:00:00.000000Z"),
      fact("s3", "a", "2026-11-01T10:00:00.000000Z"), fact("s4", "a", "2026-11-04T10:00:00.000000Z"),
      fact("s5", "d", "2026-11-03T10:00:00.000000Z"), fact("s6", "c", "2026-11-03T10:00:00.000000Z"),
      fact("s7", "e", "2026-11-01T10:00:00.000000Z", 3),
    ]);
    expect(rows.map((row) => [row.position, row.brokerId, row.value])).toEqual([[1, "e", 3], [2, "a", 2], [3, "b", 2], [4, "c", 1], [5, "d", 1]]);
  });
  it("is independent of input order and records the branch of the last fact", () => {
    const facts = [fact("x2", "a", "2026-11-02", 5, "u2"), fact("x1", "a", "2026-11-01", 5, "u1"), fact("x3", "b", "2026-11-01", 7)];
    const forward = rankIncentiveFacts(facts); const backward = rankIncentiveFacts([...facts].reverse());
    expect(canonicalJson(forward)).toBe(canonicalJson(backward));
    expect(forward[0]).toMatchObject({ brokerId: "a", value: 10, branchId: "u2", lastFactAt: "2026-11-02", facts: ["x1", "x2"] });
  });
  it("rejects invalid values", () => {
    expect(() => rankIncentiveFacts([fact("z", "a", "2026-11-01", -1)])).toThrow();
    expect(() => rankIncentiveFacts([fact("z", "a", "2026-11-01", 0.5)])).toThrow();
  });
});

describe("digest input", () => {
  const snapshot = (calculatedAt: string, branchIds = ["u2", "u1"]): IncentiveSnapshot => ({ version: 1, campaignId: "c", campaignVersion: 1, metric: "sales_count",
    period: { startsOn: "2026-11-01", endsOn: "2026-11-30", timeZone: "America/Sao_Paulo" }, branchIds, rows: rankIncentiveFacts([fact("s", "a", "2026-11-01")]), calculatedAt });
  it("ignores calculation time, key order and unit order", () => {
    expect(incentiveDigestInput(snapshot("2026-11-10T00:00:00Z"))).toBe(incentiveDigestInput(snapshot("2026-11-12T00:00:00Z", ["u1", "u2"])));
    expect(incentiveDigestInput(snapshot("x"))).not.toContain("calculatedAt");
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });
  it("changes when the version changes", () => {
    expect(incentiveDigestInput({ ...snapshot("x"), campaignVersion: 2 })).not.toBe(incentiveDigestInput(snapshot("x")));
  });
});

describe("visibleRanking", () => {
  const rows = rankIncentiveFacts([fact("1", "me", "2026-11-01", 500), fact("2", "other", "2026-11-01", 900), fact("3", "far", "2026-11-01", 100, "u2")]);
  const names = new Map([["me", "Ana"], ["other", "Bruno"], ["far", "Caio"]]);
  it("hides names and colleagues' money unless allowed", () => {
    const view = visibleRanking(rows, { userId: "me", metric: "sales_value_cents", names, canSeeName: () => false, canSeeValue: () => false });
    expect(view).toEqual([
      { position: 1, label: "Corretor 1", isViewer: false, value: null },
      { position: 2, label: "Você", isViewer: true, value: 500 },
      { position: 3, label: "Corretor 3", isViewer: false, value: null },
    ]);
  });
  it("shows only the names the viewer may see and always labels the own row as Você", () => {
    const view = visibleRanking(rows, { userId: "me", metric: "sales_count", names, canSeeName: (row) => row.branchId === "u1", canSeeValue: () => false });
    expect(view.map((row) => [row.label, row.value])).toEqual([["Bruno", 900], ["Você", 500], ["Corretor 3", 100]]);
  });
});

describe("campaign input", () => {
  const base = { name: "Novembro", regulation: "Regulamento sintético com regras completas.", metric: "sales_count", startsOn: "2026-11-01", endsOn: "2026-11-30", branchIds: ["u2", "u1", "u2"], prize: "", showNames: false };
  it("normalizes units and validates the period", () => {
    expect(incentiveCampaignInputSchema.parse(base).branchIds).toEqual(["u1", "u2"]);
    expect(incentiveCampaignInputSchema.safeParse({ ...base, endsOn: "2026-10-01" }).success).toBe(false);
    expect(incentiveCampaignInputSchema.safeParse({ ...base, metric: "points" }).success).toBe(false);
  });
  it("uses the São Paulo calendar day", () => {
    expect(todayInSaoPaulo(new Date("2026-11-13T02:00:00Z"))).toBe("2026-11-12");
  });
});
