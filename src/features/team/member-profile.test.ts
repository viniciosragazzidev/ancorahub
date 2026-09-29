import { describe, expect, it } from "vitest";
import { canViewTeamMemberProfile, summarizeLeadOfferPerformance } from "./member-profile";

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

describe("team member lead offer performance", () => {
  it("counts expired offers as not accepted even when the broker never became the lead owner", () => {
    expect(summarizeLeadOfferPerformance([
      { status: "EXPIRED", total: 15 },
    ])).toEqual({
      total: 15,
      accepted: 0,
      notAccepted: 15,
      declined: 0,
      expired: 15,
      pending: 0,
    });
  });

  it("keeps pending and race-lost offers out of the not-accepted count", () => {
    expect(summarizeLeadOfferPerformance([
      { status: "ACCEPTED", total: 2 },
      { status: "DECLINED", total: 3 },
      { status: "EXPIRED", total: 4 },
      { status: "DELIVERED", total: 1 },
      { status: "LOST", total: 5 },
      { status: "CANCELLED", total: 6 },
    ])).toEqual({
      total: 10,
      accepted: 2,
      notAccepted: 7,
      declined: 3,
      expired: 4,
      pending: 1,
    });
  });
});
