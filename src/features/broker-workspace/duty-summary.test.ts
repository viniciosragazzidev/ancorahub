import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildDutySummary, weekdayForDate } from "./duty-summary";

// Thursday 15/10/2026 for the night shift that starts at 19:00 and ends at 07:00.
const THURSDAY = "2026-10-15";

function row(overrides: Partial<Parameters<typeof buildDutySummary>[0]["rows"][number]> = {}) {
  return {
    assignmentId: "a-1",
    scheduleId: "sch-night",
    scheduleName: "Noturno",
    queueName: "PME",
    branchName: "Central",
    dayOfWeek: weekdayForDate(THURSDAY),
    startsAt: "19:00",
    endsAt: "07:00",
    timezone: "America/Sao_Paulo",
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: null,
    pausedAt: null,
    dutyDate: null,
    monthlyPlanId: null,
    attendanceMode: "online",
    confirmationStatus: null,
    confirmedBy: null,
    confirmationId: null,
    hasPhoto: null,
    ...overrides,
  };
}

function summaryAt(now: Date, rows: ReturnType<typeof row>[]) {
  return buildDutySummary({
    tenantId: "t1",
    rows,
    publishedRows: [],
    now,
    monthlySchedulingEnabled: false,
    presenceRequired: false,
    availabilityStatus: "available",
    dayOffsets: [-1, 0],
  });
}

describe("plantão lido como a tela do corretor", () => {
  it("keeps a night shift from yesterday active at 02:00 today", async () => {
    // 16/10 02:00 em São Paulo = 05:00 UTC. O turno começou ontem às 19:00.
    const summary = await summaryAt(new Date("2026-10-16T05:00:00.000Z"), [row()]);

    expect(summary?.activeAll.map((duty) => duty.scheduleId)).toEqual(["sch-night"]);
    expect(summary?.active?.startsAt.toISOString()).toBe("2026-10-15T22:00:00.000Z");
    expect(summary?.active?.endsAt.toISOString()).toBe("2026-10-16T10:00:00.000Z");
  });

  it("is not active once the night shift has ended", async () => {
    // 16/10 08:00 em São Paulo: o noturno acabou às 07:00.
    const summary = await summaryAt(new Date("2026-10-16T11:00:00.000Z"), [row()]);

    expect(summary?.activeAll ?? []).toEqual([]);
  });

  it("still reads an ordinary day shift today", async () => {
    const summary = await summaryAt(new Date("2026-10-15T13:00:00.000Z"), [row({ scheduleId: "sch-day", scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00" })]);

    expect(summary?.activeAll.map((duty) => duty.scheduleName)).toEqual(["Manhã"]);
  });

  it("returns null when no plantão is running and none is next in the day range", async () => {
    const summary = await summaryAt(new Date("2026-10-16T05:00:00.000Z"), []);

    expect(summary).toBeNull();
  });
});
