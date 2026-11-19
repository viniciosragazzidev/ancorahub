import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { COLD_RESERVATION_TTL_MS, ColdReservations } from "./cold-base";

describe("reservas da base de frios", () => {
  it("duas sessões nunca ficam com o mesmo lead", () => {
    const reservations = new ColdReservations();
    const results = [reservations.tryReserve("t1", "sessao-a", "lead-1"), reservations.tryReserve("t1", "sessao-b", "lead-1")];
    expect(results).toEqual([true, false]);
    expect(reservations.heldByOthers("t1", "sessao-b")).toEqual(["lead-1"]);
  });

  it("mesmo telefone em outro lead também fica bloqueado", () => {
    const reservations = new ColdReservations();
    expect(reservations.tryReserve("t1", "sessao-a", "lead-1", "+5521999990000")).toBe(true);
    expect(reservations.tryReserve("t1", "sessao-b", "lead-2", "+5521999990000")).toBe(false);
    expect(reservations.tryReserve("t1", "sessao-b", "lead-3", "+5521988887777")).toBe(true);
  });

  it("tenants diferentes não se misturam", () => {
    const reservations = new ColdReservations();
    expect(reservations.tryReserve("t1", "sessao-a", "lead-1")).toBe(true);
    expect(reservations.tryReserve("t2", "sessao-b", "lead-1")).toBe(true);
    expect(reservations.isHeld("t2", "lead-1")).toBe(true);
  });

  it("a distribuição enxerga a reserva até ela vencer ou ser solta", () => {
    let now = 1_000;
    const reservations = new ColdReservations(() => now);
    reservations.tryReserve("t1", "sessao-a", "lead-1");
    expect(reservations.isHeld("t1", "lead-1")).toBe(true);
    now += COLD_RESERVATION_TTL_MS;
    expect(reservations.isHeld("t1", "lead-1")).toBe(false);
    reservations.tryReserve("t1", "sessao-a", "lead-2");
    reservations.release("t1", "lead-2");
    expect(reservations.isHeld("t1", "lead-2")).toBe(false);
  });
});
