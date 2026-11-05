import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

import { dropPlanOccurrences, saoPauloToday } from "./monthly-duty-plan-assignments";

const occurrence = (scheduleId: string, dutyDate: string) => ({ id: `${scheduleId}:${dutyDate}`, scheduleId, dutyDate });

describe("tirar datas da escala mensal", () => {
  const occurrences = [occurrence("pme", "2026-11-19"), occurrence("pme", "2026-11-20"), occurrence("plantao-20", "2026-11-20"), occurrence("pme", "2026-11-21")];
  const assignments = [
    { occurrenceId: "pme:2026-11-20", brokerId: "b1" },
    { occurrenceId: "plantao-20:2026-11-20", brokerId: "b2" },
    { occurrenceId: "pme:2026-11-21", brokerId: "b3" },
  ];

  it("tirar um dia leva todos os plantões dele e as vagas, e mantém o resto", () => {
    const next = dropPlanOccurrences(occurrences, assignments, (item) => item.dutyDate === "2026-11-20");
    expect(next.occurrences.map((item) => item.id)).toEqual(["pme:2026-11-19", "pme:2026-11-21"]);
    expect(next.assignments).toEqual([{ occurrenceId: "pme:2026-11-21", brokerId: "b3" }]);
    expect([...next.droppedIds].sort()).toEqual(["plantao-20:2026-11-20", "pme:2026-11-20"]);
  });

  it("plantão apagado sai só de hoje em diante", () => {
    const next = dropPlanOccurrences(occurrences, assignments, (item) => item.scheduleId === "pme" && item.dutyDate >= "2026-11-20");
    expect(next.occurrences.map((item) => item.id)).toEqual(["pme:2026-11-19", "plantao-20:2026-11-20"]);
    expect(next.assignments).toEqual([{ occurrenceId: "plantao-20:2026-11-20", brokerId: "b2" }]);
  });

  it("hoje é a data de São Paulo", () => {
    // 01:30 UTC de 06/11 ainda é 05/11 em São Paulo.
    expect(saoPauloToday(new Date("2026-11-06T01:30:00Z"))).toBe("2026-11-05");
  });
});
