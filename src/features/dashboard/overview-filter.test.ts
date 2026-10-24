import { describe, expect, it } from "vitest";

import { operationDayStart } from "@/features/reports/metrics/lead-quality-period";

import { isOverviewPeriod, overviewWindowBounds, parseOverviewPeriod, resolveOverviewBranch } from "./overview-filter";

// São Paulo is UTC-3: 19:00 there is 22:00Z.
const AFTERNOON = new Date("2026-10-24T16:42:00.000Z"); // 13:42 on 24/10
const EVENING = new Date("2026-10-24T22:30:00.000Z"); // 19:30 on 24/10, already the next operation day

describe("overviewWindowBounds", () => {
  it("today is the operation day since 19:00 of yesterday, the same start the dashboard already used", () => {
    const { start, end } = overviewWindowBounds("today", AFTERNOON);
    expect(start.toISOString()).toBe("2026-10-23T22:00:00.000Z");
    expect(start.getTime()).toBe(operationDayStart(AFTERNOON).getTime());
    expect(end.toISOString()).toBe(AFTERNOON.toISOString());
  });

  it("defaults to today", () => {
    expect(overviewWindowBounds(undefined, AFTERNOON).start.toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });

  it("from 19:00 on, today already starts at today's 19:00", () => {
    expect(overviewWindowBounds("today", EVENING).start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("7d and 30d are N operation days ending with today's, each starting at 19:00", () => {
    expect(overviewWindowBounds("7d", AFTERNOON).start.toISOString()).toBe("2026-10-17T22:00:00.000Z");
    expect(overviewWindowBounds("30d", AFTERNOON).start.toISOString()).toBe("2026-09-24T22:00:00.000Z");
    expect(overviewWindowBounds("7d", EVENING).start.toISOString()).toBe("2026-10-18T22:00:00.000Z");
  });

  it("crosses a month boundary on the calendar", () => {
    expect(overviewWindowBounds("7d", new Date("2026-03-02T12:00:00.000Z")).start.toISOString()).toBe("2026-02-23T22:00:00.000Z");
  });
});

describe("parseOverviewPeriod", () => {
  it("accepts the three periods and their short forms, anything else is today", () => {
    expect(parseOverviewPeriod("7d")).toBe("7d");
    expect(parseOverviewPeriod("30")).toBe("30d");
    expect(parseOverviewPeriod("hoje")).toBe("today");
    expect(parseOverviewPeriod("90d")).toBe("today");
    expect(parseOverviewPeriod(undefined)).toBe("today");
    expect(isOverviewPeriod("today")).toBe(true);
    expect(isOverviewPeriod(7)).toBe(false);
  });
});

describe("resolveOverviewBranch", () => {
  it("a Diretor with the whole company can pick a unit", () => {
    expect(resolveOverviewBranch({ role: "director", sessionBranchId: null, canCompareUnits: true, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: "br-centro", source: "request" });
  });

  it("a Diretor without a unit sees the whole company", () => {
    for (const requestedBranchId of [undefined, null, "", "  "]) {
      expect(resolveOverviewBranch({ role: "director", sessionBranchId: "br-x", canCompareUnits: true, requestedBranchId }))
        .toEqual({ branchId: null, source: "none" });
    }
  });

  it("a Diretor whose custom role does not see the company cannot pick a unit", () => {
    expect(resolveOverviewBranch({ role: "director", sessionBranchId: null, canCompareUnits: false, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: null, source: "none" });
  });

  it("a Gestor always gets their own unit, whatever is asked", () => {
    expect(resolveOverviewBranch({ role: "manager", sessionBranchId: "br-ni", canCompareUnits: false, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: "br-ni", source: "session" });
    expect(resolveOverviewBranch({ role: "manager", sessionBranchId: null, canCompareUnits: false, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: null, source: "none" });
  });

  it("Supervisor and broker keep their scope and ignore the unit", () => {
    expect(resolveOverviewBranch({ role: "supervisor", sessionBranchId: "br-ni", canCompareUnits: false, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: null, source: "none" });
    expect(resolveOverviewBranch({ role: "broker", sessionBranchId: "br-ni", canCompareUnits: false, requestedBranchId: "br-centro" }))
      .toEqual({ branchId: null, source: "none" });
  });
});
