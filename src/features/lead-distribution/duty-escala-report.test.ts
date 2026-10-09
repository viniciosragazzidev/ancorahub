import { describe, expect, it } from "vitest";
import { buildDutyEscalaPdfInput, type DutyEscalaReportData } from "./duty-escala-report";
import type { MonthlyPlanOccurrence } from "./monthly-duty-plan";

function occurrence(id: string, typeId: string | null, date = "2026-10-28"): MonthlyPlanOccurrence {
  return { id, scheduleId: `schedule-${id}`, scheduleName: `Plantão ${id}`, dutyDate: date, startsAt: "09:00", endsAt: "12:00", minimumBrokers: 1, maximumBrokers: null, allowedBrokerIds: [], typeId, attendanceMode: "online" };
}

function reportData(): DutyEscalaReportData {
  return {
    plan: { id: "plan", monthKey: "2026-10", status: "superseded", settings: { rangeFrom: "2026-10-28", rangeUntil: "2026-11-04", typeKeys: [], brokers: [] }, occurrences: [], assignments: [] },
    tenant: { name: "Âncora", logoUrl: null },
    occurrences: [occurrence("a", "type-a"), occurrence("b", "type-b", "2026-11-04"), occurrence("none", null)],
    assignments: [
      { occurrenceId: "a", brokerId: "broker-a" }, { occurrenceId: "a", brokerId: "broker-b" },
      { occurrenceId: "b", brokerId: "broker-b" }, { occurrenceId: "none", brokerId: "broker-a" },
    ],
    brokers: [
      { id: "broker-a", name: "Ana", code: "A1", branchId: "branch-a", branchName: "Centro" },
      { id: "broker-b", name: "Bia", code: "B1", branchId: "branch-b", branchName: "Norte" },
    ],
    schedules: [],
    types: [
      { id: "type-a", name: "PME", hue: 180, modality: "online" },
      { id: "type-b", name: "Adesão", hue: 30, modality: "presencial" },
    ],
    scope: { kind: "geral" },
  };
}

describe("duty escala report projection", () => {
  it("keeps only brokers from the selected unit and omits empty occurrences", () => {
    const data = reportData();
    data.scope = { kind: "unidade", branchId: "branch-a", branchName: "Centro" };
    const result = buildDutyEscalaPdfInput(data);
    expect(result.showBranch).toBe(false);
    expect(result.scopeLabel).toBe("Unidade Centro");
    expect(result.occurrences.map((item) => item.id)).toEqual(["a", "none"]);
    expect(result.occurrences[0].brokers.map((item) => item.name)).toEqual(["Ana"]);
    expect(result.occurrences[1].brokers.map((item) => item.name)).toEqual(["Ana"]);
  });

  it("filters by type, including the explicit no-type key", () => {
    const data = reportData();
    data.scope = { kind: "tipo", typeId: "type-b", typeName: "Adesão" };
    expect(buildDutyEscalaPdfInput(data).occurrences.map((item) => item.id)).toEqual(["b"]);
    data.scope = { kind: "tipo", typeId: null, typeName: "Sem tipo" };
    expect(buildDutyEscalaPdfInput(data).occurrences.map((item) => item.id)).toEqual(["none"]);
  });

  it("keeps the full period and all occurrences in the general scope", () => {
    const result = buildDutyEscalaPdfInput(reportData());
    expect(result.scopeLabel).toBe("Geral");
    expect(result.periodLabel).toBe("28/10/2026 a 04/11/2026");
    expect(result.occurrences).toHaveLength(3);
    expect(result.occurrences[0].brokers).toHaveLength(2);
    expect(result.status).toBe("published");
  });
});
