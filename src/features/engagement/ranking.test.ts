import { describe, expect, it } from "vitest";

import { formatDuration, rankBroker, rankHeadline, type BrokerOfferStats } from "./ranking";

const row = (brokerId: string, offered: number, accepted: number, medianAcceptSeconds: number | null): BrokerOfferStats => ({ brokerId, offered, accepted, medianAcceptSeconds });

describe("rankBroker", () => {
  const team = [
    row("ana", 10, 9, 40),
    row("bia", 12, 6, 20),
    row("caio", 4, 4, 15),
    row("davi", 10, 6, 90),
    row("eva", 0, 0, null),
  ];

  it("ranks accepts, speed (3+ accepts) and rate (5+ offers), ignoring who got no offer", () => {
    expect(rankBroker(team, "ana")).toEqual([
      { key: "accepted", position: 1, total: 4 },
      { key: "speed", position: 3, total: 4 },
      { key: "rate", position: 1, total: 3 },
    ]);
    // caio is the fastest, but 4 offers are not enough for the rate ranking.
    expect(rankBroker(team, "caio").map((rank) => rank.key)).toEqual(["accepted", "speed"]);
    expect(rankBroker(team, "caio").find((rank) => rank.key === "speed")).toMatchObject({ position: 1 });
    expect(rankBroker(team, "eva")).toEqual([]);
  });

  it("shares the position on a tie", () => {
    const ranks = rankBroker(team, "davi");
    // bia and davi accepted 6; davi has the better rate (6/10 against 6/12), so he is 2nd and bia 3rd.
    expect(ranks.find((rank) => rank.key === "accepted")).toMatchObject({ position: 2 });
    expect(rankBroker(team, "bia").find((rank) => rank.key === "accepted")).toMatchObject({ position: 3 });
    const tie = rankBroker([row("a", 5, 5, 30), row("b", 5, 5, 30)], "b");
    expect(tie.find((rank) => rank.key === "accepted")).toMatchObject({ position: 1 });
  });

  it("formats durations and headlines", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(80)).toBe("1 min 20 s");
    expect(formatDuration(7500)).toBe("2 h 5 min");
    expect(formatDuration(null)).toBe("sem dado");
    expect(rankHeadline({ key: "speed", position: 1, total: 8 })).toBe("1º no aceite mais rápido");
  });
});
