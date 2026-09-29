import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueBrokerLeadNotification: vi.fn(),
  processMetaOutboundBatch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./broker-lead-whatsapp", () => ({
  enqueueBrokerLeadNotification: mocks.enqueueBrokerLeadNotification,
}));
vi.mock("@/features/communication-channels/outbound-service", () => ({
  processMetaOutboundBatch: mocks.processMetaOutboundBatch,
}));

import { enqueueAndProcessBrokerLeadNotification } from "./broker-lead-delivery";

describe("enqueueAndProcessBrokerLeadNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes the exact outbound message created for the current lead", async () => {
    mocks.enqueueBrokerLeadNotification.mockResolvedValue({
      queued: true,
      outboundId: "current-outbound-id",
      duplicate: false,
    });
    mocks.processMetaOutboundBatch.mockResolvedValue({
      processed: 1,
      sent: 1,
      failed: 0,
      retried: 0,
    });

    const result = await enqueueAndProcessBrokerLeadNotification({
      tenantId: "tenant-id",
      leadId: "lead-id",
      brokerId: "broker-id",
      idempotencyKey: "lead-assigned:effect-id",
    });

    expect(mocks.processMetaOutboundBatch).toHaveBeenCalledTimes(1);
    expect(mocks.processMetaOutboundBatch).toHaveBeenCalledWith(
      1,
      "tenant-id",
      "current-outbound-id",
    );
    expect(result.delivery?.sent).toBe(1);
  });

  it("does not wake the tenant backlog when no broker message was queued", async () => {
    mocks.enqueueBrokerLeadNotification.mockResolvedValue({
      queued: false,
      reason: "broker_phone_missing",
    });

    const result = await enqueueAndProcessBrokerLeadNotification({
      tenantId: "tenant-id",
      leadId: "lead-id",
      brokerId: "broker-id",
    });

    expect(mocks.processMetaOutboundBatch).not.toHaveBeenCalled();
    expect(result.delivery).toBeNull();
  });
});
