import { describe, expect, it } from "vitest";

import { compareLastAccess, formatLastAccess, formatLastAccessDetail, isLastAccessStale } from "./last-access";

// 25/11/2026 14:00 em São Paulo (UTC-3).
const now = new Date("2026-11-25T17:00:00.000Z");

describe("formatLastAccess", () => {
  it("mostra Nunca entrou sem sessão", () => {
    expect(formatLastAccess(null, now)).toBe("Nunca entrou");
    expect(formatLastAccess(undefined, now)).toBe("Nunca entrou");
    expect(formatLastAccess("", now)).toBe("Nunca entrou");
    expect(formatLastAccess("não é data", now)).toBe("Nunca entrou");
  });

  it("usa minutos e horas no mesmo dia", () => {
    expect(formatLastAccess(new Date("2026-11-25T16:59:40.000Z"), now)).toBe("agora");
    expect(formatLastAccess(new Date("2026-11-25T16:35:00.000Z"), now)).toBe("há 25 min");
    expect(formatLastAccess("2026-11-25T14:00:00.000Z", now)).toBe("há 3 h");
  });

  it("conta o dia no fuso de São Paulo, não em UTC", () => {
    // 00:30 de 25/11 em São Paulo (03:30 UTC): ainda hoje.
    expect(formatLastAccess("2026-11-25T03:30:00.000Z", now)).toBe("há 13 h");
    // 23:30 de 24/11 em São Paulo (02:30 UTC de 25/11): já é ontem, mesmo sendo o mesmo dia em UTC.
    expect(formatLastAccess("2026-11-25T02:30:00.000Z", now)).toBe("ontem");
  });

  it("mostra ontem, dias, meses e anos", () => {
    expect(formatLastAccess("2026-11-24T12:00:00.000Z", now)).toBe("ontem");
    expect(formatLastAccess("2026-11-23T12:00:00.000Z", now)).toBe("há 2 dias");
    expect(formatLastAccess("2026-11-13T12:00:00.000Z", now)).toBe("há 12 dias");
    expect(formatLastAccess("2026-08-25T12:00:00.000Z", now)).toBe("há 3 meses");
    expect(formatLastAccess("2025-11-20T12:00:00.000Z", now)).toBe("há 1 ano");
    expect(formatLastAccess("2023-11-20T12:00:00.000Z", now)).toBe("há 3 anos");
  });

  it("trata data no futuro como agora", () => {
    expect(formatLastAccess("2026-11-25T17:05:00.000Z", now)).toBe("agora");
  });
});

describe("isLastAccessStale", () => {
  it("marca quem nunca entrou ou está há mais de 7 dias fora", () => {
    expect(isLastAccessStale(null, now)).toBe(true);
    expect(isLastAccessStale("2026-11-17T16:00:00.000Z", now)).toBe(true);
    expect(isLastAccessStale("2026-11-18T18:00:00.000Z", now)).toBe(false);
    expect(isLastAccessStale("2026-11-25T14:00:00.000Z", now)).toBe(false);
  });
});

describe("formatLastAccessDetail", () => {
  it("mostra data e hora de São Paulo", () => {
    expect(formatLastAccessDetail("2026-11-25T17:32:00.000Z")).toBe("25/11/2026 às 14:32");
    expect(formatLastAccessDetail("2026-11-25T02:05:00.000Z")).toBe("24/11/2026 às 23:05");
    expect(formatLastAccessDetail(null)).toBe("Nunca entrou");
  });
});

describe("compareLastAccess", () => {
  it("ordena do mais antigo para o mais recente, com quem nunca entrou primeiro", () => {
    const list = ["2026-11-20T10:00:00.000Z", null, "2026-11-01T10:00:00.000Z", "2026-11-25T10:00:00.000Z"];
    expect([...list].sort(compareLastAccess)).toEqual([null, "2026-11-01T10:00:00.000Z", "2026-11-20T10:00:00.000Z", "2026-11-25T10:00:00.000Z"]);
  });
});
