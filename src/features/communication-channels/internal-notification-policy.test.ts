import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isInternalBrokerNotice, isMissingInternalBrokerNotificationPolicyTable } from "./internal-notification-policy";

describe("internal broker notification policy", () => {
  it("routes all team member and broker notices to the WAHA internal policy", () => {
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "brokerLeadNotification" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "leadAssignmentExpired" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "brokerInvitation" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "directText" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "lead", purpose: "leadQualification" })).toBe(false);
  });

  it("recognizes only the missing-table database error as a safe migration fallback", () => {
    expect(isMissingInternalBrokerNotificationPolicyTable({ code: "42P01" })).toBe(true);
    expect(isMissingInternalBrokerNotificationPolicyTable({ code: "42501" })).toBe(false);
    expect(isMissingInternalBrokerNotificationPolicyTable(new Error("network"))).toBe(false);
  });
});
