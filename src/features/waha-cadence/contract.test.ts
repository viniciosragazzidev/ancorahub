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

  it("reads fromMe and the serialized message id from the native WAHA id object", () => {
    const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
      event: "message.any",
      session: "broker-session",
      id: "event-1",
      payload: {
        id: {
          fromMe: true,
          remote: "5511999999999@c.us",
          id: "3EB0C1234567890",
          _serialized: "true_5511999999999@c.us_3EB0C1234567890",
        },
        timestamp: 1692113399,
        from: "5521999999999@c.us",
        to: "5511999999999@c.us",
        body: "Mensagem enviada pelo celular",
        type: "chat",
      },
    }));

    expect(event.message?.fromMe).toBe(true);
    expect(event.message?.id).toBe("true_5511999999999@c.us_3EB0C1234567890");
    expect(event.message?.from).toBe("5521999999999");
    expect(event.message?.to).toBe("5511999999999");
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
  it.each([
    ['STARTING', 'connecting'],
    ['SCAN_QR_CODE', 'connecting'],
    ['WORKING', 'active'],
    ['FAILED', 'error'],
    ['STOPPED', 'offline'],
    ['ALGO_NOVO', 'offline'],
  ])('maps native session.status %s to %s without treating pairing as offline', (status, expected) => {
    const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
      event: 'session.status',
      session: 'waha_abc',
      payload: { status },
    }));
    expect(event.sessionStatus).toBe(expected);
  });
});

describe("WAHA @lid contacts", () => {
  const native = (payload: Record<string, unknown>) => wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
    event: "message",
    session: "ancora-broker-1",
    id: "evt-lid-1",
    payload: { id: "msg-1", body: "Oi, tenho interesse", timestamp: 1_790_000_000, ...payload },
  }));

  it("uses the phone the relay attached for an @lid sender", () => {
    const event = native({ from: "123456789012345@lid", to: "5521900000000@c.us", fromMe: false, _ancora: { fromPn: "5521999428504@c.us" } });
    expect(event.message?.from).toBe("5521999428504");
    expect(event.message?.contactLidUnresolved).toBeUndefined();
  });

  it("flags an @lid sender with no phone instead of passing the LID digits off as a phone", () => {
    const event = native({ from: "123456789012345@lid", to: "5521900000000@c.us", fromMe: false });
    expect(event.message?.contactLidUnresolved).toBe(true);
  });

  it("checks the recipient side for the broker's own messages", () => {
    const resolved = native({ from: "5521900000000@c.us", to: "123456789012345@lid", fromMe: true, _ancora: { toPn: "5521999428504@c.us" } });
    expect(resolved.message?.to).toBe("5521999428504");
    expect(resolved.message?.contactLidUnresolved).toBeUndefined();
    const unresolved = native({ from: "5521900000000@c.us", to: "123456789012345@lid", fromMe: true });
    expect(unresolved.message?.contactLidUnresolved).toBe(true);
  });

  it("leaves phone-addressed messages exactly as before", () => {
    const event = native({ from: "5521999428504@c.us", to: "5521900000000@c.us", fromMe: false });
    expect(event.message?.from).toBe("5521999428504");
    expect(event.message?.contactLidUnresolved).toBeUndefined();
  });
});

describe("WAHA media messages", () => {
  it("keeps WAHA's media link so the file can be fetched through the relay", () => {
    const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
      event: "message.any",
      session: "ancora-broker-1",
      id: "evt-audio-1",
      payload: {
        id: "msg-audio", from: "5521900000000@c.us", to: "5521999428504@c.us", fromMe: true, type: "ptt", hasMedia: true,
        timestamp: 1_790_000_000,
        media: { url: "http://localhost:3000/api/files/ancora-broker-1/msg-audio.oga", mimetype: "audio/ogg; codecs=opus" },
      },
    }));
    expect(event.message?.media?.url).toBe("http://localhost:3000/api/files/ancora-broker-1/msg-audio.oga");
    expect(event.message?.media?.mimeType).toBe("audio/ogg; codecs=opus");
    expect(event.message?.type).toBe("audio");
    expect(event.message?.body).toBe("[audio]");
  });

  it("derives the kind from the file when the engine sends no usable type", () => {
    const event = wahaWebhookSchema.parse(normalizeWahaWebhookPayload({
      event: "message",
      session: "ancora-broker-1",
      id: "evt-img-1",
      payload: { id: "msg-img", from: "5521999428504@c.us", fromMe: false, hasMedia: true, timestamp: 1_790_000_000, media: { url: "/api/files/s/x.jpeg", mimetype: "image/jpeg" } },
    }));
    expect(event.message?.type).toBe("image");
  });
});
