import { describe, expect, it } from "vitest";
import { describeOwnerTransition } from "./owner-transitions";

describe("describeOwnerTransition", () => {
  it("describes assignment, handover and removal", () => {
    expect(describeOwnerTransition(null, "Kaio")).toBe("Lead atribuído a Kaio");
    expect(describeOwnerTransition("Kaio", "Edinaldo")).toBe("Atendimento passou de Kaio para Edinaldo");
    expect(describeOwnerTransition("Kaio", null)).toBe("Atribuição de Kaio removida · lead sem corretor");
  });

  it("returns null when nothing changed", () => {
    expect(describeOwnerTransition("Kaio", "Kaio")).toBeNull();
    expect(describeOwnerTransition(null, null)).toBeNull();
  });
});
