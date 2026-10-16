import { describe, expect, it } from "vitest";

import { extractSearchKeywords, likePattern, SQL_ACCENT_FROM, SQL_ACCENT_TO, stripAccents } from "./search-terms";

describe("extractSearchKeywords", () => {
  it("keeps the terms that identify the material and drops the filler", () => {
    expect(
      extractSearchKeywords("Calcule uma cotação comparativa de planos PME para 4 pessoas entre Bradesco, Amil e SulAmérica."),
    ).toEqual(["cotacao", "comparativa", "planos", "pme", "pessoas", "bradesco", "amil", "sulamerica"]);
  });

  it("ignores accents and case, so both spellings search the same", () => {
    expect(extractSearchKeywords("Cotação")).toEqual(extractSearchKeywords("cotacao"));
  });

  it("removes repeated and too-short terms and caps the count", () => {
    expect(extractSearchKeywords("amil amil AMIL de a")).toEqual(["amil"]);
    expect(extractSearchKeywords("alfa beta gama delta epsilon zeta teta iota kapa lambda", 3)).toEqual(["alfa", "beta", "gama"]);
  });

  it("returns nothing when the question is only filler", () => {
    expect(extractSearchKeywords("qual para com")).toEqual([]);
  });
});

describe("likePattern", () => {
  it("escapes LIKE wildcards so a term cannot widen the match", () => {
    expect(likePattern("50%_x")).toBe(String.raw`%50\%\_x%`);
    expect(likePattern(String.raw`a\b`)).toBe(String.raw`%a\\b%`);
  });
});

describe("SQL accent mapping", () => {
  it("maps every accented letter, in both cases, to a plain lowercase letter", () => {
    expect(SQL_ACCENT_FROM.length).toBe(SQL_ACCENT_TO.length);
    expect(SQL_ACCENT_TO).toMatch(/^[a-z]+$/);
    const map = (char: string) => SQL_ACCENT_TO[SQL_ACCENT_FROM.indexOf(char)];
    expect(map("ç")).toBe("c");
    expect(map("Ã")).toBe("a");
    expect(map("é")).toBe("e");
    expect(map("Ú")).toBe("u");
  });

  it("agrees with stripAccents for every mapped letter", () => {
    for (const char of SQL_ACCENT_FROM) {
      expect(SQL_ACCENT_TO[SQL_ACCENT_FROM.indexOf(char)]).toBe(stripAccents(char).toLowerCase());
    }
  });
});
