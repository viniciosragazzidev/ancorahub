import { describe, expect, it } from "vitest";
import { canViewTeamMemberProfile } from "./member-profile";

describe("team member profile visibility", () => {
  it("allows a director to inspect any member in the tenant", () => {
    expect(canViewTeamMemberProfile({ role: "director", branchId: null }, "branch-b")).toBe(true);
  });

  it("limits a manager to members in the same branch", () => {
    expect(canViewTeamMemberProfile({ role: "manager", branchId: "branch-a" }, "branch-a")).toBe(true);
    expect(canViewTeamMemberProfile({ role: "manager", branchId: "branch-a" }, "branch-b")).toBe(false);
  });

  it("never grants the profile to a broker or to a manager without branch scope", () => {
    expect(canViewTeamMemberProfile({ role: "broker", branchId: "branch-a" }, "branch-a")).toBe(false);
    expect(canViewTeamMemberProfile({ role: "manager", branchId: null }, "branch-a")).toBe(false);
  });
});
