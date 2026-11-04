import { describe, expect, it } from "vitest";

import { brokerAvailability, easterSunday, goodFridayKey, isNationalHoliday, saoPauloParts, withBrokerReturnPhrase } from "./broker-window";

/** São Paulo is UTC-3 (no daylight saving since 2019). */
const sp = (year: number, month: number, day: number, hour: number, minute = 0) => new Date(Date.UTC(year, month - 1, day, hour + 3, minute));

describe("feriados nacionais e Páscoa", () => {
  it("calcula a Páscoa pelo algoritmo gregoriano", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
  });

  it("Sexta-feira Santa cai dois dias antes da Páscoa", () => {
    expect(goodFridayKey(2024)).toBe("03-29");
    expect(goodFridayKey(2025)).toBe("04-18");
    expect(goodFridayKey(2026)).toBe("04-03");
  });

  it("reconhece os feriados fixos e a Sexta-feira Santa", () => {
    expect(isNationalHoliday(2026, 1, 1)).toBe(true);
    expect(isNationalHoliday(2026, 4, 21)).toBe(true);
    expect(isNationalHoliday(2026, 4, 3)).toBe(true);
    expect(isNationalHoliday(2026, 11, 20)).toBe(true);
    expect(isNationalHoliday(2026, 12, 25)).toBe(true);
  });

  it("Carnaval e Corpus Christi são dia normal de atendimento", () => {
    expect(isNationalHoliday(2026, 2, 16)).toBe(false);
    expect(isNationalHoliday(2026, 2, 17)).toBe(false);
    expect(isNationalHoliday(2026, 6, 4)).toBe(false);
  });

  it("não marca dias comuns como feriado", () => {
    expect(isNationalHoliday(2026, 4, 2)).toBe(false);
    expect(isNationalHoliday(2026, 10, 21)).toBe(false);
  });
});

describe("dia da semana em São Paulo", () => {
  it("lê o dia e a hora pelo horário de Brasília, não pelo UTC", () => {
    // 2026-10-21 é quarta-feira. 01h UTC ainda é 22h de terça em São Paulo.
    expect(saoPauloParts(new Date(Date.UTC(2026, 9, 21, 1, 0)))).toMatchObject({ year: 2026, month: 10, day: 20, hour: 22, weekday: 2 });
    expect(saoPauloParts(sp(2026, 10, 21, 10))).toMatchObject({ day: 21, hour: 10, weekday: 3 });
  });
});

describe("quando o corretor responde", () => {
  it("em instantes, de segunda a sábado, das 9h às 18h59", () => {
    expect(brokerAvailability(sp(2026, 10, 21, 10))).toEqual({ open: true, returnPhrase: "em instantes" });
    expect(brokerAvailability(sp(2026, 10, 21, 18, 59))).toEqual({ open: true, returnPhrase: "em instantes" });
    expect(brokerAvailability(sp(2026, 10, 24, 10))).toEqual({ open: true, returnPhrase: "em instantes" });
  });

  it("fora do horário a frase é neutra e nunca cita as 9h", () => {
    const closed = [
      sp(2026, 10, 21, 7), // antes das 9h num dia útil
      sp(2026, 10, 21, 19), // à noite
      sp(2026, 10, 21, 23, 30),
      sp(2026, 10, 23, 20), // sexta à noite
      sp(2026, 10, 24, 20), // sábado à noite
      sp(2026, 10, 25, 12), // domingo
      sp(2026, 4, 3, 10), // Sexta-feira Santa
      sp(2026, 4, 21, 10), // Tiradentes
      sp(2026, 11, 2, 10), // Finados
      sp(2026, 12, 24, 20), // véspera de Natal
      sp(2026, 11, 15, 10), // feriado em domingo
    ];
    for (const moment of closed) {
      expect(brokerAvailability(moment)).toEqual({ open: false, returnPhrase: "em breve" });
    }
  });
});

describe("withBrokerReturnPhrase", () => {
  it("troca {{quando}} pela frase do momento e deixa o resto", () => {
    const text = "Um corretor fala com você por aqui {{quando}}.";
    expect(withBrokerReturnPhrase(text, sp(2026, 10, 21, 20))).toBe("Um corretor fala com você por aqui em breve.");
    expect(withBrokerReturnPhrase(text, sp(2026, 10, 21, 10))).toBe("Um corretor fala com você por aqui em instantes.");
  });
});
