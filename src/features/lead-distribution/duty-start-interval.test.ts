import { describe, expect, it } from "vitest";

import { dutyStartIntervalReleaseAt, leadWaitsDutyStartInterval, resolveDutyStartInterval } from "./duty-start-interval";

const start = new Date("2026-11-11T12:00:00.000Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

describe("resolveDutyStartInterval", () => {
  it("liga com 1 a 3 confirmados e alguém pendente na primeira hora", () => {
    for (const confirmedCount of [1, 2, 3]) {
      const state = resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(5), confirmedCount, pendingCount: 2 });
      expect(state).toEqual({ active: true, endsAt: at(60), confirmedCount, pendingCount: 2 });
    }
  });

  it("desliga com 4 confirmados, sem confirmados ou sem pendentes", () => {
    expect(resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(5), confirmedCount: 4, pendingCount: 2 }).active).toBe(false);
    expect(resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(5), confirmedCount: 0, pendingCount: 2 }).active).toBe(false);
    expect(resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(5), confirmedCount: 2, pendingCount: 0 }).active).toBe(false);
  });

  it("acaba exatamente 1 hora depois do início", () => {
    expect(resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(59.9), confirmedCount: 1, pendingCount: 1 }).active).toBe(true);
    expect(resolveDutyStartInterval({ occurrenceStartsAt: start, now: at(60), confirmedCount: 1, pendingCount: 1 }).active).toBe(false);
  });
});

describe("leadWaitsDutyStartInterval", () => {
  it("só o quente não espera", () => {
    expect(leadWaitsDutyStartInterval("hot")).toBe(false);
    expect(leadWaitsDutyStartInterval("warm")).toBe(true);
    expect(leadWaitsDutyStartInterval("cold")).toBe(true);
    expect(leadWaitsDutyStartInterval(null)).toBe(true);
  });
});

describe("dutyStartIntervalReleaseAt", () => {
  it("8 min depois da oferta ou atribuição mais recente", () => {
    expect(dutyStartIntervalReleaseAt({ lastOfferAt: at(2), lastAssignedAt: at(1), now: at(5) })).toEqual(at(10));
    expect(dutyStartIntervalReleaseAt({ lastOfferAt: null, lastAssignedAt: at(4), now: at(5) })).toEqual(at(12));
  });

  it("livre sem histórico ou depois dos 8 min", () => {
    expect(dutyStartIntervalReleaseAt({ lastOfferAt: null, lastAssignedAt: null, now: at(5) })).toBeNull();
    expect(dutyStartIntervalReleaseAt({ lastOfferAt: at(2), lastAssignedAt: null, now: at(10) })).toBeNull();
  });

  it("não passa do fim da janela", () => {
    expect(dutyStartIntervalReleaseAt({ lastOfferAt: at(56), lastAssignedAt: null, now: at(57), intervalEndsAt: at(60) })).toEqual(at(60));
  });
});
