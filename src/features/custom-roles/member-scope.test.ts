import { describe, expect, it } from "vitest";

import { memberScopeLabel, requiresMemberBranch } from "./member-scope";

describe("member scope", () => {
  it("keeps system operational profiles bound to a unit", () => {
    expect(requiresMemberBranch({ jobTitle: "manager", customRoleScope: "tenant" })).toBe(true);
    expect(requiresMemberBranch({ jobTitle: "broker", customRoleScope: "none" })).toBe(true);
  });

  it("allows administrative roles to work across the tenant", () => {
    expect(requiresMemberBranch({ jobTitle: "marketing", customRoleScope: "tenant" })).toBe(false);
    expect(memberScopeLabel({ jobTitle: "marketing", customRoleScope: "tenant", branchName: null })).toBe("Geral da empresa");
  });

  it("requires one unit when the custom role is unit-scoped", () => {
    expect(requiresMemberBranch({ jobTitle: "marketing", customRoleScope: "branch" })).toBe(true);
  });
});
