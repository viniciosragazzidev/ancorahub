import { describe, expect, it } from "vitest";

import { buildSimpleQualityReport, type SimpleLeadRow } from "./lead-quality-simple";

// 13/10/2026, São Paulo = UTC-3.
const at = (clock: string) => new Date(`2026-10-13T${clock}:00-03:00`);
const lead = (values: Partial<SimpleLeadRow>): SimpleLeadRow => ({ createdAt: at("08:00"), assignedAt: null, quality: "good", queueName: "PF", brokerId: "b1", converted: false, ...values });
const window = { since: at("00:00"), until: at("19:00"), shiftSplit: at("13:30") };

describe("relatório simples de qualidade", () => {
  it("counts what arrived and what went to brokers, good x weak", () => {
    const report = buildSimpleQualityReport([
      lead({ assignedAt: at("09:10") }),
      lead({ quality: "cold", assignedAt: at("10:10"), brokerId: "b2" }),
      lead({ quality: "no_reply" }),
      lead({ quality: "other" }),
    ], window, at("19:00"));
    expect(report.arrived).toMatchObject({ total: 4, good: 1, cold: 1, noReply: 1, other: 1 });
    expect(report.distributed).toMatchObject({ total: 2, good: 1, cold: 1 });
    expect(report.brokers).toBe(2);
  });

  it("finds when the good leads ran out: no qualified good lead waiting and a weak one going out", () => {
    const report = buildSimpleQualityReport([
      lead({ createdAt: at("08:00"), assignedAt: at("09:05") }),
      lead({ quality: "cold", createdAt: at("08:30"), assignedAt: at("09:30") }),
      lead({ quality: "cold", createdAt: at("09:00"), assignedAt: at("13:10") }),
    ], window, at("19:00"));
    expect(report.byQueue[0]?.goodRanOut).toMatch(/09h$/);
    expect(report.goodRanOut?.label).toBe("09h");
  });

  it("a good lead still in qualification is not waiting yet", () => {
    const report = buildSimpleQualityReport([
      lead({ createdAt: at("08:00"), readyAt: at("11:00"), assignedAt: at("11:10") }),
      lead({ quality: "cold", createdAt: at("08:00"), assignedAt: at("09:30") }),
    ], window, at("19:00"));
    expect(report.byQueue[0]?.weakWhileGoodWaiting).toBe(0);
    expect(report.goodRanOut?.label).toBe("09h");
  });

  it("flags weak leads sent while a qualified good lead of the same queue waited", () => {
    const report = buildSimpleQualityReport([
      lead({ createdAt: at("08:00"), readyAt: at("08:05"), assignedAt: at("12:00") }),
      lead({ quality: "cold", createdAt: at("08:00"), assignedAt: at("09:30") }),
    ], window, at("19:00"));
    expect(report.byQueue[0]?.weakWhileGoodWaiting).toBe(1);
    expect(report.goodRanOut).toBeNull();
  });

  it("shows what would happen without the weak leads", () => {
    const report = buildSimpleQualityReport([
      lead({ assignedAt: at("09:00"), brokerId: "b1" }),
      lead({ assignedAt: at("14:00"), brokerId: "b2" }),
      lead({ quality: "cold", assignedAt: at("10:00"), brokerId: "b1" }),
      lead({ quality: "no_reply", assignedAt: at("15:00"), brokerId: "b2" }),
    ], window, at("19:00"));
    expect(report.withoutWeak).toEqual({ distributed: 2, removed: 2, removedShare: 50, perBrokerNow: 2, perBrokerWithout: 1 });
    expect(report.shifts.map((shift) => [shift.distributedGood, shift.distributedWeak])).toEqual([[1, 1], [1, 1]]);
  });
});
