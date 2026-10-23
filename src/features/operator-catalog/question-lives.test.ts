import { describe, expect, it } from "vitest";

import { carrierCoreName, carriersInQuestion, livesInQuestion, livesQualifierCovers } from "./question-scope";

describe("lives in the question", () => {
  it("reads the number of lives", () => {
    expect(livesInQuestion("Quanto fica Amil PME Porte I para 2 vidas de 33 e 24 anos?")).toBe(2);
    expect(livesInQuestion("valor para 3 pessoas")).toBe(3);
    expect(livesInQuestion("carência de parto na Amil")).toBeNull();
  });

  it("matches the table's lives qualifier", () => {
    expect(livesQualifierCovers("2", 2)).toBe(true);
    expect(livesQualifierCovers("3_a_4", 2)).toBe(false);
    expect(livesQualifierCovers("3_4", 4)).toBe(true);
    expect(livesQualifierCovers("30_a_99", 2)).toBe(false);
    expect(livesQualifierCovers("2_a_29", 2)).toBe(true);
    expect(livesQualifierCovers("30+", 45)).toBe(true);
    expect(livesQualifierCovers(undefined, 2)).toBe(true);
  });
});

describe("operator named by its short name", () => {
  const carriers = [
    { id: "a", name: "Bradesco Saúde" },
    { id: "b", name: "Bradesco Saúde" },
    { id: "c", name: "ASSIM SAÚDE" },
    { id: "d", name: "Amil" },
  ];

  it("finds every operator with that name, and never ASSIM from the word assim", () => {
    expect(carriersInQuestion("Quais os planos da bradesco", carriers).map((carrier) => carrier.id)).toEqual(["a", "b"]);
    expect(carriersInQuestion("é assim mesmo o reajuste da amil?", carriers).map((carrier) => carrier.id)).toEqual(["d"]);
    expect(carrierCoreName("SulAmérica Saúde")).toBe("sulamerica");
    expect(carrierCoreName("Amil")).toBeNull();
  });
});
