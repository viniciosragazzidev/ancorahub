import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, resolveLeadSchema, suggestionSchema } from "./schemas";

describe("Âncora Corretora Assistant contracts", () => {
  it("normalizes and masks phone numbers without exposing the full value", () => {
    expect(normalizePhone("(21) 99999-1234")).toBe("+21999991234");
    expect(maskPhone("+5521999991234")).toContain("****-1234");
    expect(maskPhone("+5521999991234")).not.toContain("999991234");
  });

  it("accepts only the phone as lead resolution input", () => {
    expect(resolveLeadSchema.safeParse({ phone: "+5521999991234" }).success).toBe(true);
    expect(resolveLeadSchema.safeParse({ phone: "+5521999991234", tenantId: "forged" }).success).toBe(true);
  });

  it("limits suggestion goals to the controlled vocabulary", () => {
    expect(suggestionSchema.safeParse({ goal: "ASK_MISSING_FIELD", expectedLeadVersion: 1 }).success).toBe(true);
    expect(suggestionSchema.safeParse({ goal: "RUN_TOOL", expectedLeadVersion: 1 }).success).toBe(false);
  });
});
