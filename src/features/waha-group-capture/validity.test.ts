import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATERIAL_TTL_DAYS,
  detectMaterialValidity,
  isExpired,
  parseMaterialTtlDays,
  resolveMaterialValidity,
} from "./validity";

const now = new Date("2026-10-16T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("detectMaterialValidity", () => {
  it("reads a stated range", () => {
    const found = detectMaterialValidity("Tabela Unimed PME\nVigência: 01/10/2026 a 31/10/2026\nFaixa | Valor");
    expect(found.validFrom?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(found.validUntil?.toISOString()).toBe("2026-11-01T02:59:59.000Z");
  });

  it("reads 'válida até' and ignores accents and case", () => {
    const found = detectMaterialValidity("TABELA VÁLIDA ATÉ 15/11/2026");
    expect(found.validUntil?.toISOString()).toBe("2026-11-16T02:59:59.000Z");
    expect(found.validFrom).toBeNull();
  });

  it("reads a month and year after 'vigência' as the start", () => {
    expect(detectMaterialValidity("Vigência outubro/2026").validFrom?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(detectMaterialValidity("Vigência 10/2026").validFrom?.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(detectMaterialValidity("vigencia: set de 2026").validFrom?.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("accepts two-digit years", () => {
    expect(detectMaterialValidity("válida até 30/11/26").validUntil?.toISOString()).toBe("2026-12-01T02:59:59.000Z");
  });

  it("rejects impossible dates and dates far from the validity words", () => {
    expect(detectMaterialValidity("Vigência 31/02/2026 a 28/03/2026")).toEqual({ validFrom: null, validUntil: null });
    expect(detectMaterialValidity("Reunião em 20/10/2026 com a diretoria")).toEqual({ validFrom: null, validUntil: null });
  });
});

describe("resolveMaterialValidity", () => {
  it("uses the stated end date", () => {
    const validity = resolveMaterialValidity("Vigência 01/10/2026 a 31/10/2026", now, 45);
    expect(validity.source).toBe("explicit");
    expect(validity.validUntil?.toISOString()).toBe("2026-11-01T02:59:59.000Z");
  });

  it("falls back to the default window from now when the material states nothing", () => {
    const validity = resolveMaterialValidity("Faixa | Valor\n00 a 18 | R$ 289,90", now, 45);
    expect(validity.source).toBe("default");
    expect(validity.validFrom).toBeNull();
    expect(validity.validUntil?.getTime()).toBe(now.getTime() + 45 * DAY);
  });

  it("counts the default window from the stated start, so an old table is already expired", () => {
    const validity = resolveMaterialValidity("Vigência julho/2026", now, 45);
    expect(validity.validFrom?.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(isExpired(validity, now)).toBe(true);
  });

  it("does not expire anything when the window is 0", () => {
    const validity = resolveMaterialValidity("Faixa | Valor", now, 0);
    expect(validity).toEqual({ validFrom: null, validUntil: null, source: "none" });
    expect(isExpired(validity, now)).toBe(false);
  });
});

describe("parseMaterialTtlDays", () => {
  it("reads a whole number of days, 0 included", () => {
    expect(parseMaterialTtlDays("30")).toBe(30);
    expect(parseMaterialTtlDays("0")).toBe(0);
  });

  it("uses the default for anything else", () => {
    for (const value of ["-1", "abc", "", null, undefined]) {
      expect(parseMaterialTtlDays(value)).toBe(DEFAULT_MATERIAL_TTL_DAYS);
    }
  });
});
