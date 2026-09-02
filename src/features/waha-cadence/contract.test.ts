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

  it("normalizes a native WAHA engine message webhook payload", () => {
    const nativeWahaPayload = {
      event: "message",
      session: "default",
      payload: {
        id: "false_5511999999999@c.us_3EB0C1234567890",
        timestamp: 1692113399,
        from: "5511999999999@c.us",
        to: "5511888888888@c.us",
        body: "Olá do WhatsApp!",
        fromMe: false,
        source: "app",
        hasMedia: false,
        type: "chat",
      },
    };

    const normalized = normalizeWahaWebhookPayload(nativeWahaPayload);
    const event = wahaWebhookSchema.parse(normalized);

    expect(event.type).toBe("message.inbound");
    expect(event.sessionId).toBe("default");
    expect(event.message?.from).toBe("5511999999999");
    expect(event.message?.to).toBe("5511888888888");
    expect(event.message?.body).toBe("Olá do WhatsApp!");
    expect(event.message?.type).toBe("text");
    expect(event.message?.fromMe).toBe(false);
    expect(event.message?.source).toBe("app");
  });

  it("accepts source metadata forwarded for an outgoing CRM reconciliation", () => {
    const event = wahaWebhookSchema.parse({
      eventId: "evt-message-any-api",
      type: "message.inbound",
      sessionId: "waha_session",
      occurredAt: "2026-08-24T12:00:00.000Z",
      message: {
        id: "true_5511999999999@c.us_ABC",
        from: "5511888888888",
        to: "5511999999999",
        body: "Mensagem enviada pelo CRM",
        fromMe: true,
        source: "api",
      },
    });

    expect(event.message?.source).toBe("api");
  });

  it("normalizes a native WAHA engine session.status webhook payload", () => {
    const nativeSessionPayload = {
      event: "session.status",
      session: "default",
      payload: {
        status: "WORKING",
      },
    };

    const normalized = normalizeWahaWebhookPayload(nativeSessionPayload);
    const event = wahaWebhookSchema.parse(normalized);

    expect(event.type).toBe("session.status");
    expect(event.sessionId).toBe("default");
    expect(event.sessionStatus).toBe("active");
  });
});

