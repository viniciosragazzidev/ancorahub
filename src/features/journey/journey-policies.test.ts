import { describe, expect, it } from "vitest";
import { canGrantRecognition, journeyZScore } from "./journey-policies";

describe("journey management policies", () => {
  it("keeps recognition grants within 100 points per sender per week", () => {
    expect(canGrantRecognition(50, 50)).toBe(true);
    expect(canGrantRecognition(55, 50)).toBe(false);
    expect(canGrantRecognition(-5, 10)).toBe(false);
    expect(canGrantRecognition(0, 4)).toBe(false);
  });

  it("only flags a broker when the same-rule cohort is large enough and has spread", () => {
    expect(journeyZScore([0, 0], 20)).toBe(0);
    expect(journeyZScore([5, 5, 5], 5)).toBe(0);
    expect(journeyZScore([...Array(19).fill(0), 100], 100)).toBeGreaterThanOrEqual(3);
  });
});
