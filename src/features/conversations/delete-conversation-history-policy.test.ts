import { describe, expect, it } from "vitest";

import { canDeleteConversationHistory } from "./delete-conversation-history-policy";

describe("conversation history deletion policy", () => {
  it("allows a director to delete history even when the contact is linked", () => {
    expect(canDeleteConversationHistory({
      role: "director",
      featureEnabled: true,
      hasLead: true,
      hasClient: true,
      hasTeamMember: true,
    })).toEqual({ allowed: true });
  });

  it("allows a manager to delete a truly unlinked conversation", () => {
    expect(canDeleteConversationHistory({
      role: "manager",
      featureEnabled: true,
      hasLead: false,
      hasClient: false,
      hasTeamMember: false,
    })).toEqual({ allowed: true });
  });

  it.each([
    ["lead", { hasLead: true, hasClient: false, hasTeamMember: false }],
    ["client", { hasLead: false, hasClient: true, hasTeamMember: false }],
    ["team member", { hasLead: false, hasClient: false, hasTeamMember: true }],
  ])("blocks a manager when the phone belongs to a %s", (_label, links) => {
    expect(canDeleteConversationHistory({ role: "manager", featureEnabled: true, ...links })).toEqual({
      allowed: false,
      reason: "linked_contact",
    });
  });

  it("blocks unsupported roles and the global kill switch", () => {
    expect(canDeleteConversationHistory({
      role: "supervisor",
      featureEnabled: true,
      hasLead: false,
      hasClient: false,
      hasTeamMember: false,
    })).toEqual({ allowed: false, reason: "forbidden_role" });
    expect(canDeleteConversationHistory({
      role: "director",
      featureEnabled: false,
      hasLead: true,
      hasClient: true,
      hasTeamMember: true,
    })).toEqual({ allowed: false, reason: "feature_disabled" });
  });
});
