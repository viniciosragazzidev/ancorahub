import { describe, expect, it } from "vitest";

import { canDeleteUnlinkedConversation } from "./delete-unlinked-conversation-policy";

describe("unlinked conversation deletion policy", () => {
  it.each(["director", "manager"])("allows %s to delete a truly unlinked conversation", (role) => {
    expect(canDeleteUnlinkedConversation({
      role,
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
  ])("blocks deletion when the phone belongs to a %s", (_label, links) => {
    expect(canDeleteUnlinkedConversation({ role: "director", featureEnabled: true, ...links })).toEqual({
      allowed: false,
      reason: "linked_contact",
    });
  });

  it("blocks unsupported roles and the global kill switch", () => {
    expect(canDeleteUnlinkedConversation({
      role: "supervisor",
      featureEnabled: true,
      hasLead: false,
      hasClient: false,
      hasTeamMember: false,
    })).toEqual({ allowed: false, reason: "forbidden_role" });
    expect(canDeleteUnlinkedConversation({
      role: "director",
      featureEnabled: false,
      hasLead: false,
      hasClient: false,
      hasTeamMember: false,
    })).toEqual({ allowed: false, reason: "feature_disabled" });
  });
});
