import { describe, expect, it, vi } from "vitest";
import { postSaleMediaReply, retryPostSaleOperation, routePostSaleInboundSafely } from "./conversation-operations";

describe("post-sale conversation operations", () => {
  it("uses one text-only prompt for an active survey media message", () => {
    expect(postSaleMediaReply("audio")).toContain("responder por texto");
    expect(postSaleMediaReply("image")).toContain("responder por texto");
    expect(postSaleMediaReply("text")).toBeNull();
    expect(postSaleMediaReply("document")).toBeNull();
  });

  it("retries an idempotent operation once and logs the transient error", async () => {
    const stableIdempotencyKey = "post-sale-reply:survey-1:provider-message-1";
    const enqueue = vi.fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("queued");
    const operation = () => enqueue(stableIdempotencyKey);
    const onFailure = vi.fn();

    await expect(retryPostSaleOperation(operation, onFailure)).resolves.toBe("queued");
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenNthCalledWith(1, stableIdempotencyKey);
    expect(enqueue).toHaveBeenNthCalledWith(2, stableIdempotencyKey);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it("does not swallow qualification when the active-survey lookup errors", async () => {
    const logger = vi.fn();
    const handled = await routePostSaleInboundSafely(
      async () => { throw new Error("temporary query failure"); },
      { tenantId: "tenant-a", leadId: "lead-a", channelType: "meta" },
      logger,
    );

    expect(handled).toBe(false);
    expect(logger).toHaveBeenCalledWith("[post-sale-audit] inbound_route_failed", expect.objectContaining({ tenantId: "tenant-a", leadId: "lead-a", channelType: "meta" }));
  });

  it("marks the message handled only when the router confirms an active survey", async () => {
    await expect(routePostSaleInboundSafely(async () => true, { tenantId: "tenant-a", leadId: "lead-a", channelType: "waha" })).resolves.toBe(true);
    await expect(routePostSaleInboundSafely(async () => false, { tenantId: "tenant-a", leadId: "lead-a", channelType: "waha" })).resolves.toBe(false);
  });
});
