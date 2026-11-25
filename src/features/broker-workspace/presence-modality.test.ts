import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildDutySummary, weekdayForDate } from "./duty-summary";
import { isOnlineWithPhoto, presenceModality } from "./presence-modality";

const DAY = "2026-11-25";
// 25/11 14:00 em São Paulo: o plantão das 14:10 já pede confirmação.
const now = new Date("2026-11-25T17:00:00.000Z");

function row(scheduleId: string, attendanceMode: "online" | "presencial") {
  return {
    assignmentId: `a-${scheduleId}`, scheduleId, scheduleName: `Plantão ${scheduleId}`, queueName: "PME", branchName: "Central",
    dayOfWeek: weekdayForDate(DAY), startsAt: "14:10", endsAt: "18:00", timezone: "America/Sao_Paulo",
    validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: null, pausedAt: null, dutyDate: null, monthlyPlanId: null,
    attendanceMode, confirmationStatus: null, confirmedBy: null, confirmationId: null, hasPhoto: null,
  };
}

async function askFor(mode: "online" | "presencial", photo: boolean | null) {
  const summary = await buildDutySummary({
    tenantId: "t1", rows: [row("s1", mode)], publishedRows: [], now, monthlySchedulingEnabled: false, presenceRequired: true,
    availabilityStatus: "available", dayOffsets: [0], photoRequiredBySchedule: new Map([["s1", photo]]),
  });
  return { ask: summary!.presence!, active: summary!.active };
}

describe("modalidade mostrada separada da foto na confirmação", () => {
  it("presencial sem foto: confirma com um toque e continua \"Presencial\"", async () => {
    const { ask } = await askFor("presencial", false);
    expect(ask.mode).toBe("online");
    expect(ask.modality).toBe("presencial");
    expect(presenceModality(ask)).toBe("presencial");
  });

  it("online com foto: pede a foto e continua \"Online\"", async () => {
    const { ask } = await askFor("online", true);
    expect(ask.mode).toBe("presencial");
    expect(ask.modality).toBe("online");
    expect(isOnlineWithPhoto(ask)).toBe(true);
  });

  it("sem escolha, modalidade e passo coincidem", async () => {
    const { ask } = await askFor("presencial", null);
    expect(ask).toMatchObject({ mode: "presencial", modality: "presencial" });
  });

  it("dado antigo sem modality usa o passo", () => {
    expect(presenceModality({ mode: "online" })).toBe("online");
  });
});
