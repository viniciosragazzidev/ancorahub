import { describe, expect, it } from "vitest";

import { matchTypeByName } from "./duty-type-name-match";

const types = [
  { id: "pme", name: "PME" },
  { id: "pme-premium", name: "PME Premium" },
  { id: "presencial", name: "Presencial" },
  { id: "extra", name: "Extra" },
];

describe("matchTypeByName", () => {
  it("finds the type inside the plantão name, ignoring case, accents and dates", () => {
    expect(matchTypeByName("PLANTÃO PME 25/09", types)).toEqual({ kind: "match", type: types[0] });
    expect(matchTypeByName("Plantão presencial · Manhã", types)).toEqual({ kind: "match", type: types[2] });
  });

  it("prefers the longest type name", () => {
    expect(matchTypeByName("PME Premium 02/10", types)).toEqual({ kind: "match", type: types[1] });
  });

  it("only matches whole words", () => {
    expect(matchTypeByName("Extraordinário", types)).toEqual({ kind: "none" });
  });

  it("leaves a tie for a person to decide", () => {
    const tie = [{ id: "rio", name: "Rio" }, { id: "sul", name: "Sul" }];
    expect(matchTypeByName("Plantão Rio Sul", tie)).toEqual({ kind: "ambiguous", types: tie });
  });
});
