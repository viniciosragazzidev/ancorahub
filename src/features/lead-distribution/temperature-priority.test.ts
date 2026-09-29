import { describe, expect, it } from "vitest";

import { groupByTemperatureRank, sortByTemperaturePriority, temperatureRank } from "./temperature-priority";

describe("distribution priority by temperature", () => {
  it("ranks hot, then warm or no temperature, then cold", () => {
    expect(temperatureRank("hot")).toBe(0);
    expect(temperatureRank("warm")).toBe(1);
    for (const none of ["pending", "qualified", "waiting_human", "ia_disabled", null, undefined]) expect(temperatureRank(none)).toBe(1);
    expect(temperatureRank("cold")).toBe(2);
  });

  it("orders a waiting list hot first and keeps arrival order inside each temperature", () => {
    const waiting = [
      { id: "cold-1", qualificationStatus: "cold" },
      { id: "none-1", qualificationStatus: "pending" },
      { id: "warm-1", qualificationStatus: "warm" },
      { id: "hot-1", qualificationStatus: "hot" },
      { id: "cold-2", qualificationStatus: "cold" },
      { id: "hot-2", qualificationStatus: "hot" },
    ];
    expect(sortByTemperaturePriority(waiting).map((lead) => lead.id)).toEqual(["hot-1", "hot-2", "none-1", "warm-1", "cold-1", "cold-2"]);
  });

  it("splits a batch in waves, hottest first, dropping empty temperatures", () => {
    const batch = [{ id: "a", rank: 2 as const }, { id: "b", rank: 0 as const }, { id: "c", rank: 2 as const }];
    expect(groupByTemperatureRank(batch, (item) => item.rank).map((wave) => wave.map((item) => item.id))).toEqual([["b"], ["a", "c"]]);
  });
});
