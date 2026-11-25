import { describe, expect, it } from "vitest";

import { defaultPresencePhotoRequired, effectiveAttendanceMode, parseUnitPresencePhotoDefault, presencePhotoChoiceFromStored, presencePhotoChoiceToStore, presencePhotoRequiredToStore, resolveDutyPhotoOverride, resolvePresencePhotoRequired } from "./duty-presence-domain";
import { dutyScheduleInput } from "./duty-schedule-input";

describe("Exigir foto na confirmação", () => {
  it("o padrão segue a modalidade: presencial com foto, online sem", () => {
    expect(defaultPresencePhotoRequired("presencial")).toBe(true);
    expect(defaultPresencePhotoRequired("online")).toBe(false);
    expect(resolvePresencePhotoRequired("presencial", null)).toBe(true);
    expect(resolvePresencePhotoRequired("online", undefined)).toBe(false);
    expect(resolvePresencePhotoRequired("presencial", false)).toBe(false);
    expect(resolvePresencePhotoRequired("online", true)).toBe(true);
  });

  it("sem escolha, a confirmação é a de hoje", () => {
    expect(effectiveAttendanceMode(null, "presencial")).toBe("presencial");
    expect(effectiveAttendanceMode(null, "online", null)).toBe("online");
  });

  it("desligado no presencial: confirma com um toque, sem foto", () => {
    expect(effectiveAttendanceMode(null, "presencial", false)).toBe("online");
  });

  it("ligado no online: pede a foto", () => {
    expect(effectiveAttendanceMode(null, "online", true)).toBe("presencial");
  });

  it("a escolha do diretor para um corretor continua valendo", () => {
    expect(effectiveAttendanceMode("online", "presencial", true)).toBe("online");
  });

  it("grava só o que foge do padrão; sem o campo, não mexe", () => {
    expect(presencePhotoRequiredToStore("presencial", true)).toBeNull();
    expect(presencePhotoRequiredToStore("presencial", false)).toBe(false);
    expect(presencePhotoRequiredToStore("online", true)).toBe(true);
    expect(presencePhotoRequiredToStore("online", false)).toBeNull();
    expect(presencePhotoRequiredToStore("online", undefined)).toBeUndefined();
  });

  it("o formulário manda o interruptor como texto", () => {
    const base = { name: "PME", attendanceMode: "presencial", dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", minimumBrokers: 1, validFrom: "2026-11-25" };
    expect(dutyScheduleInput.parse({ ...base, presencePhotoRequired: "false" }).presencePhotoRequired).toBe(false);
    expect(dutyScheduleInput.parse({ ...base, presencePhotoRequired: "true" }).presencePhotoRequired).toBe(true);
    expect(dutyScheduleInput.parse(base).presencePhotoRequired).toBeUndefined();
  });

  it("precedência: plantão > unidade > modalidade", () => {
    // Plantão explícito vence a unidade.
    expect(resolvePresencePhotoRequired("online", true, "never")).toBe(true);
    expect(resolvePresencePhotoRequired("presencial", false, "always")).toBe(false);
    // Plantão no padrão: vale a unidade.
    expect(resolvePresencePhotoRequired("presencial", null, "never")).toBe(false);
    expect(resolvePresencePhotoRequired("online", undefined, "always")).toBe(true);
    // Unidade sem regra: vale a modalidade.
    expect(resolvePresencePhotoRequired("presencial", null, null)).toBe(true);
    expect(resolvePresencePhotoRequired("online", null, undefined)).toBe(false);
  });

  it("a regra única alimenta a confirmação (null = modalidade)", () => {
    expect(resolveDutyPhotoOverride(null, null)).toBeNull();
    expect(resolveDutyPhotoOverride(undefined, "always")).toBe(true);
    expect(resolveDutyPhotoOverride(null, "never")).toBe(false);
    expect(resolveDutyPhotoOverride(true, "never")).toBe(true);
    expect(effectiveAttendanceMode(null, "presencial", resolveDutyPhotoOverride(null, "never"))).toBe("online");
    expect(effectiveAttendanceMode(null, "online", resolveDutyPhotoOverride(null, "always"))).toBe("presencial");
    // O corretor marcado online pelo diretor continua online, mesmo com a unidade exigindo foto.
    expect(effectiveAttendanceMode("online", "presencial", resolveDutyPhotoOverride(null, "always"))).toBe("online");
  });

  it("valor gravado da unidade: só always/never valem", () => {
    expect(parseUnitPresencePhotoDefault("always")).toBe("always");
    expect(parseUnitPresencePhotoDefault("never")).toBe("never");
    expect(parseUnitPresencePhotoDefault("default")).toBeNull();
    expect(parseUnitPresencePhotoDefault(undefined)).toBeNull();
  });

  it("a escolha de três opções do plantão: padrão grava null", () => {
    expect(presencePhotoChoiceToStore("default")).toBeNull();
    expect(presencePhotoChoiceToStore("always")).toBe(true);
    expect(presencePhotoChoiceToStore("never")).toBe(false);
    expect(presencePhotoChoiceFromStored(null)).toBe("default");
    expect(presencePhotoChoiceFromStored(true)).toBe("always");
    expect(presencePhotoChoiceFromStored(false)).toBe("never");
  });

  it("o formulário manda a escolha de três opções", () => {
    const base = { name: "PME", attendanceMode: "presencial", dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", minimumBrokers: 1, validFrom: "2026-11-25" };
    expect(dutyScheduleInput.parse({ ...base, presencePhotoChoice: "default" }).presencePhotoChoice).toBe("default");
    expect(dutyScheduleInput.parse({ ...base, presencePhotoChoice: "never" }).presencePhotoChoice).toBe("never");
    expect(dutyScheduleInput.parse({ ...base, presencePhotoChoice: "" }).presencePhotoChoice).toBeUndefined();
    expect(dutyScheduleInput.safeParse({ ...base, presencePhotoChoice: "talvez" }).success).toBe(false);
  });
});
