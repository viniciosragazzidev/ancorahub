import { describe, expect, it, vi } from "vitest";
import { getInvitationDeliveryFailureUpdate, whatsappOutboundStatusValues } from "./outbound-service";

vi.mock("server-only", () => ({}));

describe("outboundService", () => {
  it("defines supported whatsapp outbound statuses", () => {
    expect(whatsappOutboundStatusValues).toContain("pending");
    expect(whatsappOutboundStatusValues).toContain("queued");
    expect(whatsappOutboundStatusValues).toContain("sent");
    expect(whatsappOutboundStatusValues).toContain("failed");
  });

  it("keeps a transient invitation queued and marks a terminal Meta failure", () => {
    expect(getInvitationDeliveryFailureUpdate({ shouldRetry: true, attempts: 2 })).toMatchObject({
      deliveryStatus: "queued",
      deliveryAttempts: 2,
    });
    expect(getInvitationDeliveryFailureUpdate({ shouldRetry: false, attempts: 5 })).toMatchObject({
      deliveryStatus: "failed",
      deliveryAttempts: 5,
    });
  });
});
