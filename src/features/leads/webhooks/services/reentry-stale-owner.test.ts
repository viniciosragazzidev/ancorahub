import { describe, expect, it } from "vitest";

import { isStaleOwnerOnReentry, parseStagnantDays } from "./reentry-stale-owner";

const now = new Date("2026-11-23T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isStaleOwnerOnReentry", () => {
  it("releases a lead whose broker left it stalled for longer than the limit", () => {
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "in_contact", stageEnteredAt: daysAgo(40), assignedAt: daysAgo(40) }, now, 3)).toBe(true);
  });

  it("keeps a lead the broker moved recently", () => {
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "negotiation", stageEnteredAt: daysAgo(1), assignedAt: daysAgo(40) }, now, 3)).toBe(false);
  });

  it("never touches a lead without broker, sold or lost", () => {
    expect(isStaleOwnerOnReentry({ corretorId: null, status: "distributed", stageEnteredAt: daysAgo(40), assignedAt: null }, now, 3)).toBe(false);
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "converted", stageEnteredAt: daysAgo(40), assignedAt: daysAgo(40) }, now, 3)).toBe(false);
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "lost", stageEnteredAt: daysAgo(40), assignedAt: daysAgo(40) }, now, 3)).toBe(false);
  });

  it("falls back to the assignment date and reads the company limit", () => {
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "distributed", stageEnteredAt: null, assignedAt: daysAgo(5) }, now, parseStagnantDays("7"))).toBe(false);
    expect(isStaleOwnerOnReentry({ corretorId: "b1", status: "distributed", stageEnteredAt: null, assignedAt: daysAgo(5) }, now, parseStagnantDays(null))).toBe(true);
  });
});
