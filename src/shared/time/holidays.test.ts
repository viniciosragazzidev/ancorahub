import { describe, expect, it } from "vitest";

import { addBusinessMilliseconds, businessMillisecondsBetween, isWithinBusinessHours, scheduleForBusinessHours } from "./business-hours";
import { BUSINESS_HOLIDAYS, isBusinessDateKeyWithHolidays, isHoliday, isHolidayDateKey } from "./holidays";

describe("feriados", () => {
  it("cobre os nacionais de 2026 e 2027 e os do Rio", () => {
    for (const key of ["2026-01-01", "2026-04-03", "2026-04-21", "2026-11-20", "2026-12-25", "2027-03-26", "2027-11-15"]) expect(isHolidayDateKey(key)).toBe(true);
    expect(isHolidayDateKey("2026-01-20")).toBe(true);
    expect(isHolidayDateKey("2026-04-23")).toBe(true);
    // Carnaval e Corpus Christi são ponto facultativo.
    expect(isHolidayDateKey("2026-02-17")).toBe(false);
    expect(isHolidayDateKey("2026-06-04")).toBe(false);
    expect(Object.keys(BUSINESS_HOLIDAYS).every((key) => /^202[67]-\d{2}-\d{2}$/.test(key))).toBe(true);
  });

  it("usa a data de São Paulo", () => {
    // 20/11/2026 às 23h30 em São Paulo já é 21/11 em UTC.
    expect(isHoliday(new Date("2026-11-21T02:30:00Z"))).toBe(true);
    expect(isHoliday(new Date("2026-11-21T03:30:00Z"))).toBe(false);
  });

  it("dia útil exclui fim de semana e feriado", () => {
    expect(isBusinessDateKeyWithHolidays("2026-11-19")).toBe(true);
    expect(isBusinessDateKeyWithHolidays("2026-11-20")).toBe(false);
    expect(isBusinessDateKeyWithHolidays("2026-11-21")).toBe(false);
  });
});

describe("horário comercial com feriados (opt-in)", () => {
  const holidayNoon = new Date("2026-11-20T15:00:00Z");

  it("sem a opção, nada muda para as outras áreas", () => {
    expect(isWithinBusinessHours(holidayNoon)).toBe(true);
    expect(scheduleForBusinessHours(holidayNoon)).toBe(holidayNoon);
  });

  it("com a opção, o feriado fica fechado e a abertura pula para o próximo dia útil", () => {
    expect(isWithinBusinessHours(holidayNoon, { skipHolidays: true })).toBe(false);
    // Sexta 20/11 feriado: próxima abertura segunda 23/11 às 08h.
    expect(scheduleForBusinessHours(holidayNoon, { skipHolidays: true }).toISOString()).toBe("2026-11-23T11:00:00.000Z");
    // Quinta 19/11 depois das 18h também pula a sexta.
    expect(scheduleForBusinessHours(new Date("2026-11-19T22:00:00Z"), { skipHolidays: true }).toISOString()).toBe("2026-11-23T11:00:00.000Z");
  });

  it("não conta o feriado no tempo útil", () => {
    const start = new Date("2026-11-19T20:00:00Z"); // quinta 17h
    const end = new Date("2026-11-23T12:00:00Z"); // segunda 09h
    expect(businessMillisecondsBetween(start, end)).toBe(12 * 3_600_000);
    expect(businessMillisecondsBetween(start, end, { skipHolidays: true })).toBe(2 * 3_600_000);
    expect(addBusinessMilliseconds(start, 2 * 3_600_000, { skipHolidays: true }).toISOString()).toBe("2026-11-23T12:00:00.000Z");
  });
});

describe("lista de feriados em dia", () => {
  it("cobre o ano atual (acrescente o próximo ano em holidays.ts quando este teste falhar)", () => {
    expect(new Date().getFullYear()).toBeLessThanOrEqual(2027);
  });
});
