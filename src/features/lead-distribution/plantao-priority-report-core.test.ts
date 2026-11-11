import { describe, expect, it } from "vitest";

import { readPlantaoPriorityShadowRow, summarizePlantaoPriorityShadow } from "./plantao-priority-report-core";

describe("relatório do modo sombra", () => {
  it("compara a fatia de hoje com a ponderada por tipo", () => {
    const rows = [
      ...Array.from({ length: 6 }, () => ({ baselineTypeId: "premium", chosenTypeId: "premium", changed: false, temperature: "hot" })),
      ...Array.from({ length: 1 }, () => ({ baselineTypeId: "presencial", chosenTypeId: "premium", changed: true, temperature: "warm" })),
      ...Array.from({ length: 3 }, () => ({ baselineTypeId: "presencial", chosenTypeId: "presencial", changed: false, temperature: "hot" })),
    ];
    const summary = summarizePlantaoPriorityShadow(rows);
    expect(summary).toMatchObject({ total: 10, changed: 1, changedPct: 10 });
    expect(summary.types.find((type) => type.typeId === "premium")).toMatchObject({ baseline: 6, weighted: 7, baselineSharePct: 60, weightedSharePct: 70, deltaPoints: 10 });
    expect(summary.types.find((type) => type.typeId === "presencial")).toMatchObject({ baseline: 4, weighted: 3, deltaRelativePct: -25 });
  });

  it("lê só eventos com plantaoPriority", () => {
    expect(readPlantaoPriorityShadowRow({ offerId: "x" })).toBeNull();
    expect(readPlantaoPriorityShadowRow({ plantaoPriority: { baselineTypeId: "a", chosenTypeId: "b", changed: true, temperature: "hot" } })).toEqual({ baselineTypeId: "a", chosenTypeId: "b", changed: true, temperature: "hot" });
    expect(summarizePlantaoPriorityShadow([])).toMatchObject({ total: 0, changedPct: 0, types: [] });
  });
});
