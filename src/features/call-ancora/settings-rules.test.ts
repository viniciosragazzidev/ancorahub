import { describe, expect, it } from "vitest";

import { CALL_ANCORA_DEFAULT_SETTINGS, callAncoraSettingsSchema, isWindowOpenFor, parseCallAncoraSettings, startOfTodaySaoPaulo } from "./settings-rules";

describe("configurações do Call Âncora", () => {
  it("usa o padrão quando não há nada salvo ou o JSON é inválido", () => {
    expect(parseCallAncoraSettings(null)).toEqual(CALL_ANCORA_DEFAULT_SETTINGS);
    expect(parseCallAncoraSettings("{quebrado")).toEqual(CALL_ANCORA_DEFAULT_SETTINGS);
  });

  it("completa campos novos com o padrão", () => {
    expect(parseCallAncoraSettings(JSON.stringify({ dailyContactsPerBroker: 50 }))).toEqual({ ...CALL_ANCORA_DEFAULT_SETTINGS, dailyContactsPerBroker: 50 });
  });

  it("recusa período e horário invertidos", () => {
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, leadPeriodMinAgeDays: 30, leadPeriodMaxAgeDays: 10 }).success).toBe(false);
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, windowStartHour: 20, windowEndHour: 8 }).success).toBe(false);
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, dailyContactsPerBroker: 0 }).success).toBe(false);
  });

  it("janela: segunda a sábado no horário, domingo nunca, sábado opcional", () => {
    const monday10 = new Date("2026-11-16T13:00:00Z");
    const monday21 = new Date("2026-11-17T00:30:00Z");
    const saturday10 = new Date("2026-11-21T13:00:00Z");
    const sunday10 = new Date("2026-11-22T13:00:00Z");
    expect(isWindowOpenFor(CALL_ANCORA_DEFAULT_SETTINGS, monday10)).toBe(true);
    expect(isWindowOpenFor(CALL_ANCORA_DEFAULT_SETTINGS, monday21)).toBe(false);
    expect(isWindowOpenFor(CALL_ANCORA_DEFAULT_SETTINGS, saturday10)).toBe(true);
    expect(isWindowOpenFor({ ...CALL_ANCORA_DEFAULT_SETTINGS, saturdayEnabled: false }, saturday10)).toBe(false);
    expect(isWindowOpenFor(CALL_ANCORA_DEFAULT_SETTINGS, sunday10)).toBe(false);
  });

  it("o dia de hoje começa à meia-noite de São Paulo", () => {
    expect(startOfTodaySaoPaulo(new Date("2026-11-19T02:00:00Z")).toISOString()).toBe("2026-11-18T03:00:00.000Z");
  });
});
