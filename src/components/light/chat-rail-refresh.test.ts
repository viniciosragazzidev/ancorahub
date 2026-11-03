import { describe, expect, it } from "vitest";

import { RAIL_REFRESH_MS, railLoadDelay, railRealtimeDecision } from "./chat-rail-refresh";

const conversations = { kind: "domain.invalidated" as const, domain: "conversations" };

describe("barra de conversas do Lite (egress, 03/11)", () => {
  it("waits for a hidden tab instead of loading the rail", () => {
    expect(railRealtimeDecision({ detail: conversations, pathname: "/dashboard", serverRendersRail: false, visible: false })).toBe("defer");
    expect(railRealtimeDecision({ detail: conversations, pathname: "/dashboard", serverRendersRail: false, visible: true })).toBe("load");
  });

  it("does not load the rail twice when the layout refresh already brings it (manager Lite)", () => {
    expect(railRealtimeDecision({ detail: conversations, pathname: "/dashboard", serverRendersRail: true, visible: true })).toBe("skip");
    expect(railRealtimeDecision({ detail: { kind: "notification.created" }, pathname: "/equipe", serverRendersRail: true, visible: true })).toBe("skip");
  });

  it("still loads it for the manager when the signal does not refresh the layout", () => {
    expect(railRealtimeDecision({ detail: conversations, pathname: "/equipe/minha", serverRendersRail: true, visible: true })).toBe("load");
  });

  it("loads at most once every 10 s", () => {
    expect(RAIL_REFRESH_MS).toBe(10_000);
    expect(railLoadDelay(0, 100_000)).toBe(0);
    expect(railLoadDelay(100_000, 103_000)).toBe(7_000);
  });
});
