import { describe, expect, it, vi } from "vitest";
import { postSaleMediaReply, requestPostSaleTextOnceAtStep, retryPostSaleOperation, routePostSaleInboundSafely, runPostSaleOptOutTransaction } from "./conversation-operations";

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

  it("only enqueues one text request for two media messages in the same survey step", async () => {
    let promptedStep: number | null = null;
    const claimStep = vi.fn(async (step: number) => {
      if (promptedStep === step) return false;
      promptedStep = step;
      return true;
    });
    const send = vi.fn(async () => undefined);
    const releaseStep = vi.fn(async () => undefined);
    const onFailure = vi.fn();
    const request = () => requestPostSaleTextOnceAtStep({ step: 2, claimStep, send, releaseStep, onFailure });

    await expect(Promise.all([request(), request()])).resolves.toEqual([true, false]);
    expect(claimStep).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not change the survey to opted_out when the opt-out insert fails", async () => {
    const state = { status: "answering" };
    const updateSurvey = vi.fn(async (tx: typeof state) => { tx.status = "opted_out"; return tx.status; });
    const transaction = async <T>(work: (tx: typeof state) => Promise<T>) => {
      const previousStatus = state.status;
      try {
        return await work(state);
      } catch (error) {
        state.status = previousStatus;
        throw error;
      }
    };

    await expect(runPostSaleOptOutTransaction({
      transaction,
      insertOptOut: async () => { throw new Error("opt-out storage unavailable"); },
      updateSurvey,
    })).rejects.toThrow("opt-out storage unavailable");
    expect(state.status).toBe("answering");
    expect(updateSurvey).not.toHaveBeenCalled();
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
