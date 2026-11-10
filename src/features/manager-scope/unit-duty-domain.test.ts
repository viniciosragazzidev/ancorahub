import { describe, expect, it } from "vitest";

import { buildUnitDutyOccurrences, unitDutyDays, type UnitDutyRow } from "./unit-duty-domain";

const FROM = new Date("2026-01-01T00:00:00-03:00");

function row(input: Partial<UnitDutyRow> & Pick<UnitDutyRow, "brokerId" | "brokerName">): UnitDutyRow {
  return {
    scheduleId: "plantao-a", scheduleName: "Plantão A", scheduleValidFrom: FROM, scheduleValidUntil: null,
    dutyDate: null, dayOfWeek: 2, startsAt: "09:00", endsAt: "18:00", validFrom: FROM, validUntil: null, pausedAt: null,
    ...input,
  };
}

// 10/11/2026 é terça (2); 11/11 quarta (3).
const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12"];

describe("plantões da unidade do gestor", () => {
  it("monta a janela de hoje e dos próximos dias no fuso de São Paulo", () => {
    expect(unitDutyDays(new Date("2026-11-10T02:30:00Z"), 3)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
  });

  it("mostra o plantão da empresa toda em que a unidade tem corretor, só com os corretores da unidade", () => {
    const rows = [
      row({ brokerId: "da-unidade", brokerName: "Ana" }),
      row({ brokerId: "de-outra-unidade", brokerName: "Zé de Niterói" }),
    ];
    const result = buildUnitDutyOccurrences(rows, new Set(["da-unidade"]), DAYS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ scheduleId: "plantao-a", date: "2026-11-10" });
    expect(result[0]!.brokers.map((broker) => broker.name)).toEqual(["Ana"]);
    expect(JSON.stringify(result)).not.toContain("Niterói");
  });

  it("plantão sem corretor da unidade não aparece", () => {
    const rows = [row({ brokerId: "de-outra-unidade", brokerName: "Zé" })];
    expect(buildUnitDutyOccurrences(rows, new Set(["da-unidade"]), DAYS)).toEqual([]);
  });

  it("escala mensal publicada vence a semanal no mesmo plantão e data", () => {
    const rows = [
      row({ brokerId: "ana", brokerName: "Ana" }),
      row({ brokerId: "bia", brokerName: "Bia", dutyDate: "2026-11-10" }),
    ];
    const result = buildUnitDutyOccurrences(rows, new Set(["ana", "bia"]), DAYS);
    expect(result).toHaveLength(1);
    expect(result[0]!.brokers.map((broker) => broker.id)).toEqual(["bia"]);
  });

  it("respeita a validade da escala e do plantão e marca o corretor pausado", () => {
    const rows = [
      row({ brokerId: "ana", brokerName: "Ana", dayOfWeek: 3, pausedAt: new Date() }),
      row({ brokerId: "bia", brokerName: "Bia", dayOfWeek: 3, validUntil: new Date("2026-11-11T00:00:00-03:00") }),
      row({ scheduleId: "plantao-b", scheduleName: "Plantão B", scheduleValidFrom: new Date("2026-11-20T00:00:00-03:00"), brokerId: "ana", brokerName: "Ana" }),
    ];
    const result = buildUnitDutyOccurrences(rows, new Set(["ana", "bia"]), DAYS);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ date: "2026-11-11", scheduleId: "plantao-a" });
    expect(result[0]!.brokers).toEqual([{ id: "ana", name: "Ana", startsAt: "09:00", endsAt: "18:00", paused: true }]);
  });

  it("ordena por data e horário e não repete o corretor", () => {
    const rows = [
      row({ scheduleId: "tarde", scheduleName: "Tarde", startsAt: "13:00", endsAt: "19:00", brokerId: "ana", brokerName: "Ana" }),
      row({ scheduleId: "manha", scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", brokerId: "ana", brokerName: "Ana" }),
      row({ scheduleId: "manha", scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", brokerId: "ana", brokerName: "Ana" }),
    ];
    const result = buildUnitDutyOccurrences(rows, new Set(["ana"]), DAYS);
    expect(result.map((occurrence) => occurrence.scheduleId)).toEqual(["manha", "tarde"]);
    expect(result[0]!.brokers).toHaveLength(1);
  });
});
