import { describe, expect, it } from "vitest";

import { createNegotiationsFixture } from "./fixtures";
import { enteredToday } from "./negotiation-stage-summary-model";

describe("enteredToday", () => {
  it("counts only current leads at the requested level whose stage started today in São Paulo", () => {
    const data = createNegotiationsFixture("director");
    const now = new Date("2026-10-27T13:00:00.000Z");
    data.leads = [
      { ...data.leads[0]!, level: "advanced", stageEnteredAt: "2026-10-27T04:55:00.000Z" },
      { ...data.leads[1]!, level: "advanced", stageEnteredAt: "2026-10-27T05:05:00.000Z" },
      { ...data.leads[2]!, level: "closing", stageEnteredAt: "2026-10-26T23:59:59.000Z" },
      { ...data.leads[3]!, level: "advanced", stageEnteredAt: null },
      { ...data.leads[4]!, level: "advanced", stageEnteredAt: "invalid" },
    ];

    expect(enteredToday(data.leads, "advanced", now)).toBe(2);
    expect(enteredToday(data.leads, "closing", now)).toBe(0);
  });

  it("uses the São Paulo day boundary rather than the UTC date", () => {
    const data = createNegotiationsFixture("director");
    const now = new Date("2026-10-27T02:30:00.000Z"); // 26/10, 23:30 in São Paulo
    const lead = { ...data.leads[0]!, level: "in_conversation" as const, stageEnteredAt: "2026-10-27T02:00:00.000Z" };

    expect(enteredToday([lead], "in_conversation", now)).toBe(1);
    expect(enteredToday([lead], "in_conversation", new Date("2026-10-27T03:00:00.000Z"))).toBe(0);
  });
});
