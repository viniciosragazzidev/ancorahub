import { describe, expect, it } from "vitest";

import { planFeedback, takeFromBudget, type CelebrationBudget, type FeedbackPrefs } from "./core";

const ALL_ON: FeedbackPrefs = { sound: true, haptic: true, motion: true, celebrations: true };
const spent: CelebrationBudget = { take: () => false };

describe("planFeedback", () => {
  it("keeps the tap silent and only vibrates", () => {
    const plan = planFeedback("tap", ALL_ON);
    expect(plan.sound).toBeNull();
    expect(plan.haptic).toEqual([10]);
    expect(plan.celebrate).toBe(false);
  });

  it("plays the confirm sound only when the action asks for it (occasional actions)", () => {
    expect(planFeedback("confirm", ALL_ON).sound).toBeNull();
    expect(planFeedback("confirm", ALL_ON, { sound: true }).sound).toBe("confirm");
    expect(planFeedback("confirm", ALL_ON).haptic).toEqual([15]);
  });

  it("celebrates a milestone with sound, success vibration and motion", () => {
    expect(planFeedback("milestone", ALL_ON)).toMatchObject({ level: 2, sound: "milestone", haptic: [12, 40, 24], celebrate: true });
  });

  it("turns a celebration into a confirmation when celebrations are off", () => {
    const plan = planFeedback("celebrate", { ...ALL_ON, celebrations: false });
    expect(plan).toMatchObject({ level: 1, sound: null, haptic: [15], celebrate: false });
  });

  it("turns a celebration into a confirmation once the daily budget is spent", () => {
    expect(planFeedback("milestone", ALL_ON, {}, spent)).toMatchObject({ level: 1, sound: null, celebrate: false });
  });

  it("keeps sound and vibration with reduced motion but shows no celebration", () => {
    const plan = planFeedback("celebrate", { ...ALL_ON, motion: false });
    expect(plan).toMatchObject({ level: 3, sound: "milestone", celebrate: false, motion: false });
  });

  it("respects the sound and vibration switches for events", () => {
    expect(planFeedback("notify", { ...ALL_ON, sound: false })).toMatchObject({ sound: null, haptic: [20, 60, 20] });
    expect(planFeedback("error", { ...ALL_ON, haptic: false })).toMatchObject({ sound: "error", haptic: null });
  });
});

describe("takeFromBudget", () => {
  it("allows one level 2 per key per day and three level 3 per day", () => {
    let state = { day: "2026-11-14", counts: {} as Record<string, number> };
    const first = takeFromBudget(state, "2026-11-14", 2, "meta-do-dia");
    expect(first.allowed).toBe(true);
    state = first.next;
    expect(takeFromBudget(state, "2026-11-14", 2, "meta-do-dia").allowed).toBe(false);
    expect(takeFromBudget(state, "2026-11-14", 2, "missao").allowed).toBe(true);
    for (let i = 0; i < 3; i += 1) {
      const step = takeFromBudget(state, "2026-11-14", 3, "venda");
      expect(step.allowed).toBe(true);
      state = step.next;
    }
    expect(takeFromBudget(state, "2026-11-14", 3, "nivel").allowed).toBe(false);
  });

  it("starts over on a new day", () => {
    const used = { day: "2026-11-14", counts: { "nivel-2:meta-do-dia": 1 } };
    expect(takeFromBudget(used, "2026-11-15", 2, "meta-do-dia").allowed).toBe(true);
  });
});
