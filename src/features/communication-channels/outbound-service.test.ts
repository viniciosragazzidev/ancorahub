import { describe, expect, it, vi } from "vitest";
import { getInvitationDeliveryFailureUpdate, whatsappOutboundStatusValues } from "./outbound-service";
import { BROKER_LEAD_NOTIFICATION_INTERVAL_MS, scheduleBrokerLeadNotification } from "@/features/notifications/broker-lead-cadence";

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

  it("spaces broker lead notifications by the configured interval", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    expect(scheduleBrokerLeadNotification({ now }).toISOString()).toBe(now.toISOString());
    expect(scheduleBrokerLeadNotification({ now, lastScheduledAt: now }).toISOString())
      .toBe(new Date(now.getTime() + BROKER_LEAD_NOTIFICATION_INTERVAL_MS).toISOString());
  });
});
