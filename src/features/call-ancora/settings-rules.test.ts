import { describe, expect, it } from "vitest";

import { CALL_ANCORA_DEFAULT_SETTINGS, callAncoraSettingsSchema, coldCreatedAfter, deviceHangupRules, isWindowOpenFor, leadsFromStart, parseCallAncoraSettings, startOfTodaySaoPaulo } from "./settings-rules";

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

  describe("Só leads a partir de", () => {
    const now = new Date("2026-11-23T15:00:00Z");
    const day = 24 * 60 * 60_000;

    it("sem data: vale só o período em dias (comportamento de antes)", () => {
      expect(CALL_ANCORA_DEFAULT_SETTINGS.leadsFromDate).toBeNull();
      expect(leadsFromStart(null)).toBeNull();
      expect(coldCreatedAfter({ maxAgeDays: 365, leadsFromDate: null }, now)?.getTime()).toBe(now.getTime() - 365 * day);
    });

    it("com data: começa à meia-noite de São Paulo e vence o período quando é mais recente", () => {
      const from = coldCreatedAfter({ maxAgeDays: 365, leadsFromDate: "2026-11-01" }, now);
      expect(from?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
      // Data mais antiga que o período: o período em dias continua mandando.
      expect(coldCreatedAfter({ maxAgeDays: 30, leadsFromDate: "2025-01-01" }, now)?.getTime()).toBe(now.getTime() - 30 * day);
    });

    it("borda do dia no fuso: 23h59 do dia anterior fica fora, 00h00 entra", () => {
      const start = leadsFromStart("2026-11-01")!.getTime();
      const lastMinuteBefore = new Date("2026-11-01T02:59:59.999Z").getTime(); // 31/10 23:59:59 em São Paulo
      const midnight = new Date("2026-11-01T03:00:00.000Z").getTime(); // 01/11 00:00 em São Paulo
      expect(lastMinuteBefore >= start).toBe(false);
      expect(midnight >= start).toBe(true);
    });

    it("recusa data que não existe e aceita vazio", () => {
      expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, leadsFromDate: "2026-02-30" }).success).toBe(false);
      expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, leadsFromDate: "01/11/2026" }).success).toBe(false);
      expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, leadsFromDate: "2026-11-01" }).success).toBe(true);
      expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, leadsFromDate: null }).success).toBe(true);
    });

    it("configuração antiga sem o campo lê como sem filtro", () => {
      expect(parseCallAncoraSettings(JSON.stringify({ dailyContactsPerBroker: 50 })).leadsFromDate).toBeNull();
    });
  });

  it("discagem automática é o padrão", () => {
    expect(CALL_ANCORA_DEFAULT_SETTINGS.autoDialByDefault).toBe(true);
  });

  it("desligamento automático: padrão 22/4/25 s, faixas validadas e formato do celular", () => {
    expect(deviceHangupRules(CALL_ANCORA_DEFAULT_SETTINGS)).toEqual({ enabled: true, ringTimeoutSec: 22, quickActiveSec: 4, voicemailAfterSec: 25 });
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, ringTimeoutSeconds: 10 }).success).toBe(false);
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, quickActiveSeconds: 9 }).success).toBe(false);
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, voicemailAfterSeconds: 61 }).success).toBe(false);
    expect(callAncoraSettingsSchema.safeParse({ ...CALL_ANCORA_DEFAULT_SETTINGS, autoHangupEnabled: false, ringTimeoutSeconds: 30 }).success).toBe(true);
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
