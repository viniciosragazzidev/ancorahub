import { describe, expect, it } from "vitest";
import { isExtensionLeadVisibleForUser, selectVisibleExtensionLead } from "./lead-context";

const user = { userId: "broker-1", branchId: "branch-1" };

describe("isExtensionLeadVisibleForUser", () => {
  it("only exposes a lead assigned to the extension user in the same branch", () => {
    expect(isExtensionLeadVisibleForUser(user, { corretorId: "broker-1", branchId: "branch-1" })).toBe(true);
  });

  it("does not use manager or director visibility as an extension bypass", () => {
    expect(isExtensionLeadVisibleForUser(user, { corretorId: "broker-2", branchId: "branch-1" })).toBe(false);
    expect(isExtensionLeadVisibleForUser(user, { corretorId: "broker-1", branchId: "branch-2" })).toBe(false);
  });

  it("fails closed when the extension session has no branch", () => {
    expect(isExtensionLeadVisibleForUser({ userId: "broker-1", branchId: null }, { corretorId: "broker-1", branchId: "branch-1" })).toBe(false);
  });

  it("selects the authorized lead when duplicated phones include an inaccessible record", () => {
    const inaccessible = { id: "lead-other", corretorId: "broker-2", branchId: "branch-1" };
    const visible = { id: "lead-mine", corretorId: "broker-1", branchId: "branch-1" };

    expect(selectVisibleExtensionLead(user, [inaccessible, visible])).toBe(visible);
  });
});
