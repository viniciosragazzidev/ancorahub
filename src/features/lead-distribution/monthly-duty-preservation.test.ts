import { describe, expect, it } from "vitest";

import { decideLeftoverRows, type LeftoverRow } from "./monthly-duty-preservation";

const PREMIUM = "type-premium";
const PME = "type-pme";
const typeOf: Record<string, string> = { "sch-premium": PREMIUM, "sch-pme": PME };
const occurrenceIdOf = (scheduleId: string, dutyDate: string) => `${scheduleId}:${dutyDate}`;

function row(overrides: Partial<LeftoverRow> = {}): LeftoverRow {
  return { id: "row-1", scheduleId: "sch-premium", brokerId: "bruno", dutyDate: "2026-10-20", startsAt: "08:00", monthlyPlanId: "plan-9", ...overrides };
}

function decide(overrides: Partial<Parameters<typeof decideLeftoverRows>[0]> & { leftovers: LeftoverRow[] }) {
  return decideLeftoverRows({
    draftOccurrenceIds: new Set(),
    generatedTypeKeys: [PME],
    rangeFrom: "2026-10-01",
    rangeUntil: "2026-10-31",
    typeKeyOfSchedule: (scheduleId) => typeOf[scheduleId] ?? "none",
    started: () => false,
    occurrenceIdOf,
    ...overrides,
  });
}

describe("publicar uma escala preserva quem está escalado fora do JSON", () => {
  it("keeps a dated row that is not in the JSON when the draft redraws another type", () => {
    // Bruno foi colocado direto no banco no plantão Premium. O rascunho refez só o PME.
    const result = decide({ leftovers: [row()] });

    expect(result.removeIds).toEqual([]);
    expect(result.preserved.map((item) => item.row.id)).toEqual(["row-1"]);
  });

  it("puts the preserved row back into the new escala when the draft still lists its plantão", () => {
    const result = decide({ leftovers: [row()], draftOccurrenceIds: new Set([occurrenceIdOf("sch-premium", "2026-10-20")]) });

    expect(result.preserved[0]?.occurrenceId).toBe("sch-premium:2026-10-20");
  });
});

describe("o que sai do roster de verdade", () => {
  it("removes a row of a type that this generation redrew, inside the period, not started", () => {
    const result = decide({ leftovers: [row({ scheduleId: "sch-pme", id: "row-pme" })] });

    expect(result.removeIds).toEqual(["row-pme"]);
  });

  it("keeps a redrawn plantão that already started: nobody leaves the roster mid-shift", () => {
    const result = decide({ leftovers: [row({ scheduleId: "sch-pme", id: "row-pme" })], started: () => true });

    expect(result.removeIds).toEqual([]);
    expect(result.preserved.map((item) => item.row.id)).toEqual(["row-pme"]);
  });

  it("keeps a row of the redrawn type when its date is outside the generated period", () => {
    const result = decide({ leftovers: [row({ scheduleId: "sch-pme", id: "row-late", dutyDate: "2026-11-02" })] });

    expect(result.removeIds).toEqual([]);
  });

  it("treats an escala from before the type field as fully redrawn", () => {
    const result = decide({ leftovers: [row({ scheduleId: "sch-premium", id: "row-old" })], generatedTypeKeys: null });

    expect(result.removeIds).toEqual(["row-old"]);
  });
});
