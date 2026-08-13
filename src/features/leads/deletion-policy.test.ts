import { describe, expect, it } from "vitest";
import { canDeleteLead } from "./deletion-policy";

describe("lead deletion policy", () => {
  it("allows only the director to remove a lead from the active operation", () => {
    expect(canDeleteLead("director")).toBe(true);
    expect(canDeleteLead("manager")).toBe(false);
    expect(canDeleteLead("supervisor")).toBe(false);
    expect(canDeleteLead("broker")).toBe(false);
  });
});
