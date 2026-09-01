import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isInternalBrokerNotice } from "./internal-notification-policy";

describe("internal broker notification policy", () => {
  it("limits the WAHA internal route to broker operational notices", () => {
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "brokerLeadNotification" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "leadAssignmentExpired" })).toBe(true);
    expect(isInternalBrokerNotice({ recipientType: "lead", purpose: "leadQualification" })).toBe(false);
    expect(isInternalBrokerNotice({ recipientType: "user", purpose: "brokerInvitation" })).toBe(false);
  });
});
