import { describe, expect, it } from "vitest";

import { resolveDutyTurns } from "./duty-turn-core";

const at = (clock: string) => new Date(`2026-10-29T${clock}:00-03:00`);
const roster = [
  { brokerId: "ana", confirmedAt: at("08:40"), canReceive: true },
  { brokerId: "bia", confirmedAt: at("08:50"), canReceive: false },
  { brokerId: "caio", confirmedAt: at("09:05"), canReceive: true },
  { brokerId: "duda", confirmedAt: at("10:30"), canReceive: true },
];

describe("turn on the plantão cards (29/10)", () => {
  it("marks receiving now, next and received last, and orders the cards by the turn", () => {
    const state = resolveDutyTurns({
      stored: ["caio", "duda", "ana", "bia"],
      roster,
      offers: [
        { brokerId: "ana", status: "EXPIRED", offeredAt: at("10:00"), expiresAt: at("10:15") },
        { brokerId: "bia", status: "PENDING", offeredAt: at("11:00"), expiresAt: at("11:15") },
      ],
      now: at("11:05"),
    });
    expect(state.byBroker.bia).toMatchObject({ role: "current" });
    expect(state.byBroker.caio).toMatchObject({ role: "next", position: 1 });
    expect(state.byBroker.ana).toMatchObject({ role: "previous", outcome: "skip", skips: 1, position: 3 });
    expect(Object.keys(state.rank).sort((left, right) => state.rank[left] - state.rank[right])).toEqual(["bia", "caio", "duda", "ana"]);
  });

  it("before the first lead the queue is the order of arrival", () => {
    const state = resolveDutyTurns({ stored: null, roster, offers: [], now: at("09:10") });
    expect(state.byBroker.ana).toMatchObject({ role: "next", position: 1 });
    expect(state.byBroker.caio.position).toBe(2);
    expect(state.byBroker.bia.position).toBeNull();
  });
});
