import { describe, expect, it } from "vitest";

import { sortTeamsForDistribution } from "./teams-lite";

describe("ordem das equipes", () => {
  it("põe primeiro quem tem lead para distribuir, depois mais leads em aberto", () => {
    const sorted = sortTeamsForDistribution([
      { id: "a", listPending: 0, companyOpen: 84 },
      { id: "b", listPending: 1476, companyOpen: 320 },
      { id: "c", listPending: 3685, companyOpen: 41 },
      { id: "d", listPending: 0, companyOpen: 165 },
    ]);
    expect(sorted.map((team) => team.id)).toEqual(["c", "b", "d", "a"]);
  });
});
