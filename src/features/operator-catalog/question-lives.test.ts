import { describe, expect, it } from "vitest";

import { livesInQuestion, livesQualifierCovers } from "./question-scope";

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
