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

describe("corretor online dentro de um plantão presencial", () => {
  // With the presence check on (production): an online broker is asked to confirm.
  const checkedAt = (now: Date, rows: ReturnType<typeof row>[]) => buildDutySummary({
    tenantId: "t1", rows, publishedRows: [], now, monthlySchedulingEnabled: false, presenceRequired: true, availabilityStatus: "available", dayOffsets: [-1, 0],
  });

  it("is not asked for anything when the presence check is off", async () => {
    const summary = await summaryAt(new Date("2026-10-16T05:00:00.000Z"), [row({ attendanceMode: "presencial", assignmentAttendanceMode: "online" })]);

    expect(summary?.presence).toBeNull();
    expect(summary?.active?.presenceStatus).toBe("not_required");
  });

  it("asks for a one-tap confirmation, never the photo or the director's release", async () => {
    const now = new Date("2026-10-16T05:00:00.000Z");
    const presencial = await checkedAt(now, [row({ attendanceMode: "presencial", confirmationStatus: "pending", hasPhoto: true, confirmationId: "c-1" })]);
    const online = await checkedAt(now, [row({ attendanceMode: "presencial", assignmentAttendanceMode: "online", confirmationStatus: "pending", hasPhoto: true, confirmationId: "c-1" })]);

    expect(presencial?.presence).toMatchObject({ mode: "presencial", status: "awaiting_release" });
    expect(online?.presence).toMatchObject({ mode: "online", status: "pending" });
    expect(online?.active?.attendanceMode).toBe("online");
  });

  it("counts his own tap as confirmed (no confirmedBy needed)", async () => {
    const summary = await checkedAt(new Date("2026-10-16T05:00:00.000Z"), [row({ attendanceMode: "presencial", assignmentAttendanceMode: "online", confirmationStatus: "confirmed" })]);

    expect(summary?.active?.presenceStatus).toBe("confirmed");
    expect(summary?.presence).toMatchObject({ mode: "online", status: "confirmed" });
  });

  it("keeps simultaneous active and imminent duties, pending first", async () => {
    const summary = await checkedAt(new Date("2026-10-16T05:00:00.000Z"), [
      row({ assignmentId: "confirmed-online", scheduleId: "sch-online", scheduleName: "PME Online", confirmationStatus: "confirmed" }),
      row({
        assignmentId: "pending-presencial",
        scheduleId: "sch-presencial",
        scheduleName: "Presencial Tarde",
        attendanceMode: "presencial",
        dayOfWeek: weekdayForDate("2026-10-16"),
        startsAt: "02:15",
        endsAt: "06:00",
      }),
    ]);

    expect(summary?.presences).toMatchObject([
      { assignmentId: "pending-presencial", scheduleId: "sch-presencial", status: "pending", scheduleName: "Presencial Tarde" },
      { assignmentId: "confirmed-online", scheduleId: "sch-online", status: "confirmed", scheduleName: "PME Online" },
    ]);
    expect(summary?.presence?.assignmentId).toBe("pending-presencial");
  });

  it("keeps two unconfirmed duties in deterministic start order", async () => {
    const summary = await checkedAt(new Date("2026-10-16T05:00:00.000Z"), [
      row({ assignmentId: "later", scheduleId: "sch-later", startsAt: "19:30" }),
      row({ assignmentId: "earlier", scheduleId: "sch-earlier", startsAt: "19:00" }),
    ]);

    expect(summary?.presences.map((presence) => presence.assignmentId)).toEqual(["earlier", "later"]);
  });
});
