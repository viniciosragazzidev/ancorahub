import { describe, expect, it } from "vitest";

import { canManageLeadTags, canTagLead, normalizeLeadTagName } from "./rules";

describe("lead tags", () => {
  it("cleans a tag name", () => {
    expect(normalizeLeadTagName("  Retornar   amanhã ")).toBe("Retornar amanhã");
    expect(normalizeLeadTagName("   ")).toBe("");
    expect(normalizeLeadTagName("x".repeat(50))).toHaveLength(32);
  });

  it("only directors and managers keep the tag list", () => {
    expect(canManageLeadTags("director")).toBe(true);
    expect(canManageLeadTags("manager")).toBe(true);
    expect(canManageLeadTags("broker")).toBe(false);
  });

  it("tags a lead within the user's reach", () => {
    const lead = { corretorId: "b1", branchId: "u1" };
    expect(canTagLead({ role: "director", userId: "d", branchId: null }, lead)).toBe(true);
    expect(canTagLead({ role: "manager", userId: "m", branchId: "u1" }, lead)).toBe(true);
    expect(canTagLead({ role: "manager", userId: "m", branchId: "u2" }, lead)).toBe(false);
    expect(canTagLead({ role: "broker", userId: "b1", branchId: "u1" }, lead)).toBe(true);
    expect(canTagLead({ role: "broker", userId: "b2", branchId: "u1" }, lead)).toBe(false);
  });
});
