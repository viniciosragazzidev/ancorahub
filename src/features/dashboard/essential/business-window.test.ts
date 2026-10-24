import { describe, expect, it } from "vitest";

import { businessTurnStart, isWeekendInZone, windowLabel } from "./business-window";

// 2026-10-24 é sábado. Horários em UTC: São Paulo é UTC-3.
const at = (iso: string) => new Date(iso);

describe("janela do dia de operação", () => {
  it("na terça de manhã, começa na segunda 19h", () => {
    expect(businessTurnStart(at("2026-10-27T13:00:00Z")).toISOString()).toBe("2026-10-26T22:00:00.000Z");
  });

  it("na segunda de manhã, começa na sexta 19h (não no domingo)", () => {
    expect(businessTurnStart(at("2026-10-26T13:00:00Z")).toISOString()).toBe("2026-10-23T22:00:00.000Z");
    expect(windowLabel(businessTurnStart(at("2026-10-26T13:00:00Z")))).toBe("desde sex 19h");
  });

  it("no sábado, começa na sexta 19h", () => {
    expect(businessTurnStart(at("2026-10-24T13:00:00Z")).toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });

  it("depois das 19h de segunda, o turno é o de hoje", () => {
    expect(businessTurnStart(at("2026-10-26T23:30:00Z")).toISOString()).toBe("2026-10-26T22:00:00.000Z");
  });

  it("recua dias úteis e pula o fim de semana", () => {
    // Terça 10h, 2 dias úteis atrás: segunda (1) e sexta (2).
    expect(businessTurnStart(at("2026-10-27T13:00:00Z"), 2).toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });

  it("reconhece sábado e domingo no fuso de São Paulo", () => {
    expect(isWeekendInZone(at("2026-10-24T13:00:00Z"))).toBe(true);
    expect(isWeekendInZone(at("2026-10-25T13:00:00Z"))).toBe(true);
    expect(isWeekendInZone(at("2026-10-26T13:00:00Z"))).toBe(false);
  });
});
