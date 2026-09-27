import { describe, expect, it } from "vitest";
import { parseCreateDutyScheduleInput, parseDutyScheduleInput } from "./duty-schedule-input";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const base = {
  name: "Plantão manhã",
  startsAt: "09:00",
  endsAt: "13:00",
  minimumBrokers: "2",
  validFrom: "2026-10-01",
};

describe("duty schedule input", () => {
  // Regression: a refined schema used with .omit() threw at module load and took
  // the whole /leads/distribuicao route down.
  it("loads and parses both create and update inputs", () => {
    expect(parseCreateDutyScheduleInput(form({ ...base, daysOfWeek: "[1]" })).success).toBe(true);
    expect(parseDutyScheduleInput(form({ ...base, dayOfWeek: "1" })).success).toBe(true);
  });

  it("keeps the maximum optional (empty means no ceiling)", () => {
    const result = parseCreateDutyScheduleInput(form({ ...base, daysOfWeek: "[1]", maximumBrokers: "" }));
    expect(result.success && result.data.maximumBrokers).toBeNull();
  });

  it("rejects a maximum below the minimum on create and on update", () => {
    const create = parseCreateDutyScheduleInput(form({ ...base, daysOfWeek: "[1]", maximumBrokers: "1" }));
    const update = parseDutyScheduleInput(form({ ...base, dayOfWeek: "1", maximumBrokers: "1" }));
    expect(create.success).toBe(false);
    expect(update.success).toBe(false);
    expect(create.error?.issues[0]?.path).toEqual(["maximumBrokers"]);
  });

  it("reads validity dates as São Paulo calendar days, with the end day included", () => {
    const result = parseCreateDutyScheduleInput(form({ ...base, daysOfWeek: "[1]", validFrom: "2026-10-01", validUntil: "2026-12-31" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.validFrom.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(result.data.validUntil?.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("keeps an empty end date as no end", () => {
    const result = parseCreateDutyScheduleInput(form({ ...base, daysOfWeek: "[1]", validUntil: "" }));
    expect(result.success && result.data.validUntil).toBeUndefined();
  });

  it("accepts a list of dates for one-day plantões", () => {
    const result = parseCreateDutyScheduleInput(form({ ...base, dates: JSON.stringify(["2026-09-30", "2026-10-01"]) }));
    expect(result.success && result.data.dates).toEqual(["2026-09-30", "2026-10-01"]);
    expect(parseCreateDutyScheduleInput(form({ ...base, dates: JSON.stringify(["2026-09-30", "2026-09-30"]) })).success).toBe(false);
  });
});

