import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBrokerInvitationDispatchTarget } from "./broker-invitation-delivery";

describe("broker invitation delivery", () => {
  it("targets the newly queued outbox row instead of an oldest-first batch", () => {
    expect(getBrokerInvitationDispatchTarget({
      status: "queued",
      tenantId: "tenant-1",
      outboundId: "outbound-1",
    })).toEqual({ limit: 1, tenantId: "tenant-1", outboundId: "outbound-1" });
  });

  it("does not schedule a dispatch for failed or explicitly deferred invitations", () => {
    expect(getBrokerInvitationDispatchTarget({
      status: "failed",
      tenantId: "tenant-1",
      outboundId: "outbound-1",
    })).toBeNull();
    expect(getBrokerInvitationDispatchTarget({
      status: "queued",
      scheduleDelivery: false,
      tenantId: "tenant-1",
      outboundId: "outbound-1",
    })).toBeNull();
  });
});
