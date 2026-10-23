import { describe, expect, it } from "vitest";

import { buildMaterialAsks, questionAreas, type MaterialCoverage } from "./material-asks";

const rows: MaterialCoverage[] = [
  { carrierName: "Amil", planName: "Amil S380", areaSlug: "precos", facts: 120 },
  { carrierName: "Amil", planName: "Amil S450", areaSlug: "precos", facts: 60 },
  { carrierName: "Amil", planName: "Amil Bronze RJ", areaSlug: "rede_credenciada", facts: 40 },
  { carrierName: "Amil", planName: null, areaSlug: "carencias", facts: 12 },
  { carrierName: "Amil", planName: null, areaSlug: "comissionamento", facts: 30 },
  { carrierName: "Bradesco", planName: null, areaSlug: "carencias", facts: 5 },
];

describe("buildMaterialAsks", () => {
  it("suggests only subjects with material, one per area first", () => {
    const asks = buildMaterialAsks(rows, { seed: 0, limit: 3 });
    expect(asks.map((ask) => ask.areaSlug)).toEqual(["precos", "rede_credenciada", "carencias"]);
    expect(asks[0]).toMatchObject({ label: "Preços Amil S380 para 2 vidas", question: "Quanto fica Amil S380 para 2 vidas de 30 e 25 anos?" });
    expect(asks.some((ask) => ask.areaSlug === "comissionamento")).toBe(false);
  });

  it("follows an operator and skips the subject just answered", () => {
    const asks = buildMaterialAsks(rows, { seed: 0, limit: 3, focusCarrier: "amil", excludeAreas: ["precos"] });
    expect(asks.map((ask) => ask.areaSlug)).toEqual(["rede_credenciada", "carencias"]);
  });

  it("rotates with the seed and returns nothing without material", () => {
    expect(buildMaterialAsks(rows, { seed: 1, limit: 1 })[0]?.areaSlug).toBe("rede_credenciada");
    expect(buildMaterialAsks([], { seed: 3, limit: 3 })).toEqual([]);
  });
});

describe("questionAreas", () => {
  it("reads the subjects of a question", () => {
    expect(questionAreas("Quanto fica Amil PME para 2 vidas?")).toEqual(["precos"]);
    expect(questionAreas("Quais hospitais da amil?")).toEqual(["rede_credenciada"]);
  });
});
