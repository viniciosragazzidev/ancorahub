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

  it("antes das 9h num dia útil: hoje, a partir das 9h", () => {
    expect(brokerAvailability(sp(2026, 10, 21, 7))).toEqual({ open: false, returnPhrase: "hoje, a partir das 9h" });
  });

  it("à noite num dia útil: amanhã, a partir das 9h", () => {
    expect(brokerAvailability(sp(2026, 10, 21, 19))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
    expect(brokerAvailability(sp(2026, 10, 21, 23, 30))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("sexta à noite: o sábado conta como dia de atendimento", () => {
    expect(brokerAvailability(sp(2026, 10, 23, 20))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("sábado à noite: próximo dia útil, a partir das 9h, e domingo de manhã vira amanhã", () => {
    expect(brokerAvailability(sp(2026, 10, 24, 20))).toEqual({ open: false, returnPhrase: "no próximo dia útil, a partir das 9h" });
    expect(brokerAvailability(sp(2026, 10, 25, 12))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("feriado não atende, como domingo: Sexta-feira Santa, sábado de manhã segue o atendimento", () => {
    expect(brokerAvailability(sp(2026, 4, 3, 10))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("feriado fixo em dia útil: Tiradentes numa terça", () => {
    expect(brokerAvailability(sp(2026, 4, 21, 10))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("feriado numa segunda, com a terça seguinte útil: Finados", () => {
    expect(brokerAvailability(sp(2026, 11, 2, 10))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });

  it("véspera de feriado sexta: Natal cai numa sexta, o retorno vai para o próximo dia útil", () => {
    // 24/12 é quinta. Às 20h, amanhã é feriado (sexta, Natal), o sábado seguinte é dia de atendimento, então não é amanhã.
    expect(brokerAvailability(sp(2026, 12, 24, 20))).toEqual({ open: false, returnPhrase: "no próximo dia útil, a partir das 9h" });
  });

  it("feriado em domingo: segunda seguinte, como amanhã", () => {
    // 15/11/2026 é domingo e feriado. A segunda 16/11 é dia útil.
    expect(brokerAvailability(sp(2026, 11, 15, 10))).toEqual({ open: false, returnPhrase: "amanhã, a partir das 9h" });
  });
});

describe("withBrokerReturnPhrase", () => {
  it("troca {{quando}} pela frase do momento e deixa o resto", () => {
    const text = "Um corretor fala com você por aqui {{quando}}.";
    expect(withBrokerReturnPhrase(text, sp(2026, 10, 21, 20))).toBe("Um corretor fala com você por aqui amanhã, a partir das 9h.");
    expect(withBrokerReturnPhrase(text, sp(2026, 10, 21, 10))).toBe("Um corretor fala com você por aqui em instantes.");
  });
});
