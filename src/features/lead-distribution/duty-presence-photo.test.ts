import { describe, expect, it } from "vitest";

import { defaultPresencePhotoRequired, effectiveAttendanceMode, presencePhotoRequiredToStore, resolvePresencePhotoRequired } from "./duty-presence-domain";
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
});
