import { describe, expect, it } from "vitest";

import { codesInName, excelSerialToDate, matchBrokerByName, normalizeBrokerCode, parseEscalaSheet, seatsByBroker } from "./duty-escala-import";

// 2026-10-08 = 46303, 2026-10-09 = 46304 (Excel 1900 serials).
const sheet: unknown[][] = [
  [],
  [],
  ["", "PME", "PME", "PME"],
  ["Dias", 46303, 46304, 46302],
  ["", "8556 - ROGERIO DOS SANTOS", "406 - JORGE OSCAR MAIA"],
  ["", "6580 - DANDHARA LIMA ", "12156 - WALLACE LUIZ DE OLIVEIRA"],
  ["9H ÀS 18H", "0129 - CRISTIANE MARQUES", "sem código aqui"],
  ["", "8556 - ROGERIO DOS SANTOS", ""],
];

describe("parseEscalaSheet", () => {
  it("reads the dates of the header and the brokers of each date", () => {
    expect(excelSerialToDate(46303)).toBe("2026-10-08");
    const parsed = parseEscalaSheet(sheet);
    expect(parsed.days.map((day) => day.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(parsed.days.find((day) => day.date === "2026-10-08")?.brokers).toEqual([
      { code: "8556", name: "ROGERIO DOS SANTOS" },
      { code: "6580", name: "DANDHARA LIMA" },
      { code: "129", name: "CRISTIANE MARQUES" },
    ]);
  });

  it("keeps an empty date and reports cells that are not '<code> - <name>'", () => {
    const parsed = parseEscalaSheet(sheet);
    expect(parsed.days.find((day) => day.date === "2026-10-07")?.brokers).toEqual([]);
    expect(parsed.unreadable).toEqual([{ date: "2026-10-09", text: "sem código aqui" }]);
  });

  it("counts one seat per date per broker", () => {
    const seats = seatsByBroker(parseEscalaSheet(sheet).days);
    expect(seats.get("8556")).toBe(1);
    expect(seats.get("406")).toBe(1);
  });

  it("normalizes codes and refuses a sheet without the 'Dias' header", () => {
    expect(normalizeBrokerCode("0406")).toBe("406");
    expect(normalizeBrokerCode("0")).toBe("0");
    expect(() => parseEscalaSheet([["x"]])).toThrow(/Dias/);
  });
});

describe("matchBrokerByName", () => {
  const crm = [
    { id: "a", name: "Angela Cristina dos Santos Lima" },
    { id: "b", name: "Jorge Oscar Maia" },
    { id: "c", name: "Cristiane Marques" },
    { id: "d", name: "Cristiane Marques Souza" },
    { id: "e", name: "Roberta Olímpio Ferreira" },
  ];
  it("matches a cut name, ignoring accents and connectors", () => {
    expect(matchBrokerByName("ANGELA CRISTINA DOS SANTO", crm)).toEqual({ kind: "match", candidate: crm[0] });
    expect(matchBrokerByName("ROBERTA OLIMPIO FERREIRA", crm)).toEqual({ kind: "match", candidate: crm[4] });
  });
  it("never guesses between two brokers or from a single word", () => {
    expect(matchBrokerByName("CRISTIANE MARQUES", crm).kind).toBe("ambiguous");
    expect(matchBrokerByName("JORGE", crm).kind).toBe("none");
    expect(matchBrokerByName("JORGE SILVA", crm).kind).toBe("none");
  });
});

describe("codesInName", () => {
  it("reads the sheet code kept in the CRM name", () => {
    expect(codesInName("Dandhara Lima 6580")).toEqual(["6580"]);
    expect(codesInName("Jorge Maia 0406")).toEqual(["406"]);
    expect(codesInName("Maria Souza")).toEqual([]);
  });
});
