import { describe, expect, it } from "vitest";

import { pickSeats, standaloneSeats, type StandaloneSchedule } from "./seats";

/**
 * Caso real de 23/11: "Adicione a Bruna Soares nos 3 horários de plantões de hoje do Plantão Niterói".
 * Os 3 horários eram plantões avulsos (um dia, criados em Plantões, fora da escala mensal publicada) e o agente
 * respondia "não achei vaga" porque só lia a escala mensal.
 */
const TODAY = "2026-11-23"; // segunda
const NITEROI_BRANCH = "branch-niteroi";

function niteroi(id: string, startsAt: string, endsAt: string): StandaloneSchedule {
  return {
    id, name: "Plantão Niterói", dayOfWeek: 1, startsAt, endsAt,
    typeId: "tipo-niteroi", typeName: "Plantão Niterói", typeBranchIds: [NITEROI_BRANCH], attendanceMode: "presencial",
    minimumBrokers: 1, maximumBrokers: null, validFrom: TODAY, validUntil: "2026-11-24",
  };
}

const schedules = [niteroi("s-09", "09:00", "12:00"), niteroi("s-12", "12:00", "15:00"), niteroi("s-15", "15:00", "18:00")];
const brokers = [{ id: "bruna", branchId: NITEROI_BRANCH }, { id: "caio", branchId: "branch-centro" }];
const base = { schedules, roster: [], brokers, coveredIds: new Set<string>(), from: TODAY, until: TODAY, today: TODAY, nowTime: "08:30" };

describe("vagas em plantão avulso", () => {
  it("acha os 3 horários de hoje do Plantão Niterói e escala nos 3 no mesmo dia", () => {
    const seats = standaloneSeats(base);
    expect(seats.map((seat) => seat.id)).toEqual(["s-09:2026-11-23", "s-12:2026-11-23", "s-15:2026-11-23"]);
    expect(seats.every((seat) => seat.source === "avulso" && seat.allowedBrokerIds.includes("bruna"))).toBe(true);
    const pick = pickSeats(seats, "bruna", 3, { from: TODAY, until: TODAY, scheduleText: "Niterói", maxPerDay: 3 });
    expect(pick.picked.map((choice) => choice.occurrence.startsAt)).toEqual(["09:00", "12:00", "15:00"]);
    expect(pick.picked.some((choice) => choice.outsideType)).toBe(false);
  });

  it("corretor de outra unidade só entra como fora do tipo", () => {
    const pick = pickSeats(standaloneSeats(base), "caio", 3, { maxPerDay: 3 });
    expect(pick.picked).toHaveLength(0);
    expect(pick.outsideTypeAvailable).toBe(3);
  });

  it("horário em andamento ainda aceita gente; horário que acabou sai", () => {
    const seats = standaloneSeats({ ...base, nowTime: "12:30" });
    expect(seats.find((seat) => seat.startsAt === "09:00")?.ended).toBe(true);
    const pick = pickSeats(seats, "bruna", 3, { maxPerDay: 3 });
    expect(pick.picked.map((choice) => choice.occurrence.startsAt)).toEqual(["12:00", "15:00"]);
  });

  it("quem já está no avulso não repete e o resto continua livre", () => {
    const seats = standaloneSeats({ ...base, roster: [{ scheduleId: "s-09", brokerId: "bruna", dayOfWeek: 1 }] });
    const pick = pickSeats(seats, "bruna", 3, { maxPerDay: 3 });
    expect(pick.picked.map((choice) => choice.occurrence.startsAt)).toEqual(["12:00", "15:00"]);
  });

  it("não duplica o que a escala mensal já traz e ignora plantão semanal fixo", () => {
    const weekly = { ...niteroi("s-fixo", "09:00", "18:00"), validUntil: null };
    const seats = standaloneSeats({ ...base, schedules: [...schedules, weekly], coveredIds: new Set(["s-12:2026-11-23"]) });
    expect(seats.map((seat) => seat.scheduleId)).toEqual(["s-09", "s-15"]);
  });
});
