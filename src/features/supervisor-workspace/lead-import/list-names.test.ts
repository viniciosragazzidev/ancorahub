import { describe, expect, it } from "vitest";

import { ALL_LISTS, LIST_NAME_MAX, cleanListName, defaultListName, teamListHref, uniqueListName } from "./list-names";

describe("nomes das listas de importação (DEC-191)", () => {
  it("usa a data de Brasília no nome padrão", () => {
    expect(defaultListName(new Date("2026-11-24T15:00:00Z"))).toBe("Lista 24/11");
    // 01:30 UTC do dia 25 ainda é 24/11 em Brasília.
    expect(defaultListName(new Date("2026-11-25T01:30:00Z"))).toBe("Lista 24/11");
  });

  it("numera a segunda lista do mesmo dia", () => {
    expect(uniqueListName("Lista 24/11", [])).toBe("Lista 24/11");
    expect(uniqueListName("Lista 24/11", ["Lista 24/11"])).toBe("Lista 24/11 (2)");
    expect(uniqueListName("Lista 24/11", ["lista 24/11", "Lista 24/11 (2)"])).toBe("Lista 24/11 (3)");
    expect(uniqueListName("Clientes Barra", ["Lista 24/11"])).toBe("Clientes Barra");
  });

  it("limpa o nome digitado", () => {
    expect(cleanListName("  Clientes   da \n Barra  ")).toBe("Clientes da Barra");
    expect(cleanListName("Lista — Barra")).toBe("Lista - Barra");
    expect(cleanListName("")).toBe("");
    expect(cleanListName(null)).toBe("");
    expect(cleanListName("x".repeat(100))).toHaveLength(LIST_NAME_MAX);
  });

  it("o sufixo cabe no limite", () => {
    const long = "x".repeat(LIST_NAME_MAX);
    const next = uniqueListName(long, [long]);
    expect(next.endsWith(" (2)")).toBe(true);
    expect(next.length).toBeLessThanOrEqual(LIST_NAME_MAX);
  });

  it("monta os endereços das pastas", () => {
    expect(teamListHref(null)).toBe("/leads?vista=lista");
    expect(teamListHref("abc")).toBe("/leads?vista=lista&lista=abc");
    expect(teamListHref(ALL_LISTS)).toBe("/leads?vista=lista&lista=todas");
  });
});
