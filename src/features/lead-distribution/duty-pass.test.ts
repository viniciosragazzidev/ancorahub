import { describe, expect, it, vi } from "vitest";

import { leavingProblem, passSeat, passWarningText, seatPassCheck, seatsOverlap, type PassSeat } from "./duty-pass";

const ana = { id: "ana", name: "Ana", role: "broker", status: "active" };
const bia = { id: "bia", name: "Bia", role: "broker", status: "active" };

function seat(overrides: Partial<PassSeat> = {}): PassSeat {
  return {
    id: "sch-1:2026-11-28",
    scheduleName: "Online Manhã",
    dutyDate: "2026-11-28",
    startsAt: "08:00",
    endsAt: "12:00",
    brokerIds: ["ana"],
    allowedBrokerIds: ["ana", "bia"],
    started: false,
    ended: false,
    source: "published",
    ...overrides,
  };
}

describe("seatPassCheck", () => {
  it.each(["published", "draft", "avulso"] as const)("passa a cadeira na escala %s quando B não tem plantão", (source) => {
    expect(seatPassCheck({ seat: seat({ source }), from: ana, to: bia, sameDaySeats: [] })).toEqual({ ok: true, warnings: [], overlapping: [] });
  });

  it("recusa quando B já está no mesmo plantão", () => {
    const result = seatPassCheck({ seat: seat({ brokerIds: ["ana", "bia"] }), from: ana, to: bia });
    expect(result).toMatchObject({ ok: false, code: "ja_estava" });
  });

  it("avisa quando B está em outro plantão no mesmo horário", () => {
    const other = seat({ id: "sch-2:2026-11-28", scheduleName: "Presencial", startsAt: "10:00", endsAt: "14:00", brokerIds: ["bia"] });
    const result = seatPassCheck({ seat: seat(), from: ana, to: bia, sameDaySeats: [seat(), other] });
    expect(result).toEqual({ ok: true, warnings: ["mesmo_horario"], overlapping: ["Presencial, 28/11, 10:00 às 14:00"] });
    expect(passWarningText("mesmo_horario", "Bia", seat(), result.ok ? result.overlapping : [])).toBe("Bia já está em Presencial, 28/11, 10:00 às 14:00 no mesmo horário.");
  });

  it("não avisa plantão de B em outro horário do dia", () => {
    const afternoon = seat({ id: "sch-2:2026-11-28", startsAt: "12:00", endsAt: "18:00", brokerIds: ["bia"] });
    expect(seatPassCheck({ seat: seat(), from: ana, to: bia, sameDaySeats: [afternoon] })).toMatchObject({ ok: true, warnings: [] });
  });

  it("avisa quando a unidade de B está fora do tipo do plantão", () => {
    const result = seatPassCheck({ seat: seat({ allowedBrokerIds: ["ana"] }), from: ana, to: bia });
    expect(result).toMatchObject({ ok: true, warnings: ["fora_do_tipo"] });
    expect(passWarningText("fora_do_tipo", "Bia", seat())).toBe("A unidade de Bia não participa do tipo de Online Manhã.");
  });

  it("recusa quem entra sem ser corretor ativo, quem sai sem estar no plantão e plantão começado", () => {
    expect(seatPassCheck({ seat: seat(), from: ana, to: { ...bia, status: "inactive" } })).toMatchObject({ ok: false, code: "pessoa" });
    expect(seatPassCheck({ seat: seat(), from: ana, to: ana })).toMatchObject({ ok: false, code: "pessoa" });
    expect(seatPassCheck({ seat: seat({ brokerIds: ["carla"] }), from: ana, to: bia })).toMatchObject({ ok: false, code: "nao_estava" });
    expect(seatPassCheck({ seat: seat({ started: true }), from: ana, to: bia })).toMatchObject({ ok: false, code: "comecou" });
    expect(leavingProblem(seat({ ended: true }), ana)).toMatchObject({ code: "terminou" });
    expect(leavingProblem(seat(), ana)).toBeNull();
  });
});

describe("seatsOverlap", () => {
  it("considera plantão que passa da meia-noite", () => {
    const night = seat({ startsAt: "22:00", endsAt: "02:00" });
    expect(seatsOverlap(night, seat({ startsAt: "23:00", endsAt: "23:30" }))).toBe(true);
    expect(seatsOverlap(night, seat({ dutyDate: "2026-11-29", startsAt: "23:00", endsAt: "23:30" }))).toBe(false);
  });
});

describe("passSeat", () => {
  it("tira quem sai e põe quem entra", async () => {
    const calls: string[] = [];
    const ops = { removeSeat: vi.fn(async (_s: string, id: string) => { calls.push(`-${id}`); }), addSeat: vi.fn(async (_s: string, id: string) => { calls.push(`+${id}`); }) };
    await passSeat(ops, "seat", "ana", "bia", false);
    expect(calls).toEqual(["-ana", "+bia"]);
  });

  it("devolve a cadeira para quem saía se a entrada falhar", async () => {
    const calls: string[] = [];
    const ops = {
      removeSeat: vi.fn(async (_s: string, id: string) => { calls.push(`-${id}`); }),
      addSeat: vi.fn(async (_s: string, id: string, force: boolean) => {
        if (id === "bia") throw new Error("lotado");
        calls.push(`+${id}:${force}`);
      }),
    };
    await expect(passSeat(ops, "seat", "ana", "bia", false)).rejects.toThrow("lotado");
    expect(calls).toEqual(["-ana", "+ana:true"]);
  });
});
