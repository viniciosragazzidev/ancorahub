import { describe, expect, it } from "vitest";

import {
  cadenceDefinitionSchema,
  normalizeWahaWebhookPayload,
  phoneHash,
  relaySignature,
  verifyRelaySignature,
  wahaWebhookSchema,
} from "./contract";

describe("WAHA cadence contract", () => {
  it("accepts a versioned cadence without sensitive content", () => {
    expect(cadenceDefinitionSchema.parse({
      steps: [{ kind: "message", body: "Olá! Posso ajudar com seu atendimento?", waitMinutesAfter: 30 }],
      schedule: { startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5] },
    }).steps).toHaveLength(1);
  });

  it("rejects credentials and invalid schedule windows", () => {
    expect(() => cadenceDefinitionSchema.parse({
      steps: [{ kind: "message", body: "Envie sua senha", waitMinutesAfter: 30 }],
      schedule: { startHour: 18, endHour: 9, weekdays: [1] },
    })).toThrow();
  });

  it("uses a stable non-reversible phone key for suppression", () => {
    expect(phoneHash("+55 (21) 99999-0000")).toBe(phoneHash("5521999990000"));
    expect(phoneHash("5521999990000")).not.toContain("99999");
  });

  it("accepts only a valid and timely relay signature", () => {
    const timestamp = String(Date.now());
    const nonce = "test-nonce";
    const rawBody = '{"eventId":"evt-1"}';
    const secret = "secret";
    const signature = relaySignature(secret, timestamp, nonce, rawBody);
    expect(verifyRelaySignature({ secret, timestamp, nonce, signature, rawBody })).toBe(true);
    expect(verifyRelaySignature({ secret, timestamp, nonce, signature: "00", rawBody })).toBe(false);
  });

  it("normalizes a WAHA WhatsApp JID before validating the inbound phone", () => {
    const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
      eventId: "evt-1",
      type: "message.inbound",
      sessionId: "waha_session",
      occurredAt: "2026-08-24T12:00:00.000Z",
      message: {
        id: "message-1",
        from: "5511999999999@c.us",
        to: "5511888888888@c.us",
        body: "Olá",
      },
    }));

    expect(event.message?.from).toBe("5511999999999");
    expect(event.message?.to).toBe("5511888888888");
  });
});
