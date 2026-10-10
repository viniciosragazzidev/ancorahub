import { describe, expect, it } from "vitest";

import { availableSteps, SUPERVISOR_TOUR_STEPS, SUPERVISOR_TOUR_STORAGE_KEY, TOUR_STORAGE_KEY, totalXp } from "./tour-steps";

describe("supervisor tour", () => {
  it("starts with the intro, ends with the finale and has unique ids with its own storage key", () => {
    expect(SUPERVISOR_TOUR_STEPS[0]!.kind).toBe("intro");
    expect(SUPERVISOR_TOUR_STEPS.at(-1)!.kind).toBe("finale");
    expect(new Set(SUPERVISOR_TOUR_STEPS.map((step) => step.id)).size).toBe(SUPERVISOR_TOUR_STEPS.length);
    expect(SUPERVISOR_TOUR_STORAGE_KEY).not.toBe(TOUR_STORAGE_KEY);
    expect(totalXp(SUPERVISOR_TOUR_STEPS)).toBeGreaterThan(0);
  });

  it("only points at areas of the supervisor Início (no broker-only threads, no em dash)", () => {
    const targets = SUPERVISOR_TOUR_STEPS.map((step) => step.target).filter(Boolean);
    expect(targets).toEqual(["home-header", "home-tabs", "thread-equipe", "thread-equipe-leads", "thread-equipe-plantao", "thread-equipe-desempenho", "thread-ancora", "home-pill", "home-me"]);
    for (const step of SUPERVISOR_TOUR_STEPS) expect(`${step.title} ${step.body} ${step.narration}`).not.toContain("—");
  });

  it("drops a spotlight whose area is not on screen", () => {
    const visible = availableSteps(SUPERVISOR_TOUR_STEPS, (target) => target !== "thread-equipe-desempenho");
    expect(visible.map((step) => step.id)).not.toContain("sup-05-desempenho");
  });
});
