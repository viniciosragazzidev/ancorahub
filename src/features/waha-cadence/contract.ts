import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const WAHA_CADENCE_FEATURE = "feature_waha_cadence_enabled";
export const WAHA_AI_FEATURE = "feature_waha_ai_enabled";

const eventTypes = ["message.inbound", "message.status", "session.status"] as const;

export const cadenceDefinitionSchema = z.object({
  steps: z.array(z.object({
    kind: z.literal("message"),
    body: z.string().trim().min(1).max(1_000),
    waitMinutesAfter: z.number().int().min(1).max(43_200).default(1_440),
  }).strict()).min(1).max(20),
  schedule: z.object({
    startHour: z.number().int().min(0).max(23).default(9),
    endHour: z.number().int().min(1).max(24).default(18),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5]),
  }).strict().default({ startHour: 9, endHour: 18, weekdays: [1, 2, 3, 4, 5] }),
}).strict().superRefine((value, ctx) => {
  if (value.schedule.endHour <= value.schedule.startHour) {
    ctx.addIssue({ code: "custom", path: ["schedule", "endHour"], message: "O horário final deve ser posterior ao inicial." });
  }
  for (const step of value.steps) {
    // Prevent common sensitive identifiers in a reusable cadence definition.
    if (/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[\s-]?\d{2}\b|\b(?:senha|token|cart[aã]o|diagn[oó]stico)\b/i.test(step.body)) {
      ctx.addIssue({ code: "custom", path: ["steps"], message: "A cadência não pode conter dados sensíveis ou credenciais." });
      break;
    }
  }
});

export type CadenceDefinition = z.infer<typeof cadenceDefinitionSchema>;

export const relaySendRequestSchema = z.object({
  requestId: z.string().uuid(),
  idempotencyKey: z.string().min(16).max(160),
  sessionId: z.string().min(1).max(120),
  destination: z.string().regex(/^\d{10,15}$/),
  body: z.string().min(1).max(1_000),
}).strict();

export const relaySessionCreateSchema = z.object({
  sessionId: z.string().regex(/^[a-z0-9-]{8,120}$/),
  tenantId: z.string().optional(),
  userId: z.string().optional(),
});

export const relaySessionStateSchema = z.object({
  sessionId: z.string().min(1).max(120),
  status: z.enum(["pending", "connecting", "active", "paused", "offline", "error"]),
  displayPhoneNumber: z.string().max(40).nullable(),
  qrCode: z.string().max(2_000_000).nullable(),
}).strict();

export const wahaWebhookSchema = z.object({
  eventId: z.string().min(1).max(200),
  type: z.enum(eventTypes),
  sessionId: z.string().min(1).max(120),
  occurredAt: z.string().datetime(),
  message: z.object({
    id: z.string().min(1).max(200),
    from: z.string().regex(/^\d{10,15}$/),
    to: z.string().regex(/^\d{10,15}$/).optional(),
    body: z.string().trim().min(1).max(4_000),
    /** Message type (text, image, audio, video, document, sticker, location, contact) */
    type: z.enum(["text", "image", "audio", "video", "document", "sticker", "location", "contact"]).default("text"),
    /** Whether this message was sent by the session owner (broker's own messages) */
    fromMe: z.boolean().default(false),
    /**
     * The contact side (sender, or recipient when fromMe) arrived as a
     * WhatsApp `@lid` the relay could not map to a phone: `from`/`to` then
     * hold LID digits, not a phone, and must not be matched to a lead.
     */
    contactLidUnresolved: z.boolean().optional(),
    /** Provider-origin metadata used only for observability and outgoing reconciliation. */
    source: z.string().trim().min(1).max(64).optional(),
    /** Caption for media messages */
    caption: z.string().max(1_000).optional(),
    /** Reply context: the ID of the message being replied to */
    replyToId: z.string().max(200).optional(),
    /** Media metadata */
    media: z.object({
      mimeType: z.string().max(100).optional(),
      fileName: z.string().max(255).optional(),
      sizeBytes: z.number().int().optional(),
      /** WAHA's link to the stored file; only its /api/files path is ever fetched, through the relay. */
      url: z.string().max(2000).optional(),
      /** What the infra relay forwards instead of the link: `/api/files/<session>/<file>`. */
      providerPath: z.string().regex(/^\/api\/files\//).max(1024).optional(),
    }).strict().optional(),
  }).strict().optional(),
  delivery: z.object({
    idempotencyKey: z.string().min(16).max(160),
    providerMessageId: z.string().min(1).max(200).optional(),
    status: z.enum(["sent", "delivered", "read", "failed"]),
  }).strict().optional(),
  sessionStatus: z.enum(["active", "connecting", "paused", "offline", "error"]).optional(),
}).strict();

export type WahaWebhookEvent = z.infer<typeof wahaWebhookSchema>;

/**
 * Normaliza envelopes de webhook do WAHA para o schema canônico do CRM.
 * Suporta tanto o payload nativo do motor WAHA ({ event: "message", session: "...", payload: { ... } })
 * quanto payloads já pré-formatados pelo relay.
 */
export function normalizeWahaWebhookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const raw = payload as Record<string, unknown>;

  const normalizeJid = (value: unknown) =>
    typeof value === "string" ? value.replace(/@[^\s]+$/, "").replace(/\D/g, "") : value;
  // An `@lid` is a privacy id, not a phone: prefer the phone the relay
  // attached (`payload._ancora.{from,to}Pn`, see whatsapp-api lid.ts).
  const contactJid = (value: unknown, phone: unknown) =>
    typeof value === "string" && value.endsWith("@lid") && typeof phone === "string" && phone.trim()
      ? normalizeJid(phone)
      : normalizeJid(value);
  const isUnresolvedLid = (value: unknown, phone: unknown) =>
    typeof value === "string" && value.endsWith("@lid") && !(typeof phone === "string" && phone.trim());

  const rawEventType = String(raw.event || raw.type || "");
  const isNativeWahaMessage =
    rawEventType === "message" ||
    rawEventType === "message.any" ||
    rawEventType === "message.inbound";
  const isNativeWahaSession = rawEventType === "session.status";
  const isNativeWahaAck = rawEventType === "message.ack" || rawEventType === "message.status";

  const innerPayload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : null;

  if (innerPayload && (isNativeWahaMessage || isNativeWahaSession || isNativeWahaAck)) {
    const sessionId = String(raw.session || raw.sessionId || "");
    const eventId = String(
      raw.id ||
        innerPayload.id ||
        `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );

    let occurredAt = new Date().toISOString();
    const ts = innerPayload.timestamp ?? raw.timestamp ?? raw.occurredAt;
    if (typeof ts === "number") {
      occurredAt = new Date(ts > 1e11 ? ts : ts * 1000).toISOString();
    } else if (typeof ts === "string") {
      const parsed = Date.parse(ts);
      if (!Number.isNaN(parsed)) occurredAt = new Date(parsed).toISOString();
    }

    if (isNativeWahaMessage) {
      const rawType = String(innerPayload.type || "chat");
      // Voice notes arrive as "ptt"; some engines omit the type on media and
      // only send the file's mimetype, so the kind is derived from it.
      const rawMedia = innerPayload.media && typeof innerPayload.media === "object" ? innerPayload.media as Record<string, unknown> : null;
      const rawMime = String(rawMedia?.mimetype ?? rawMedia?.mimeType ?? "").toLowerCase();
      const kindFromMime = !rawMime ? null
        : rawMime.startsWith("audio/") ? "audio"
          : rawMime.startsWith("image/") ? "image"
            : rawMime.startsWith("video/") ? "video"
              : "document";
      const mappedType =
        rawType === "ptt" || rawType === "voice"
          ? "audio"
          : [
              "image",
              "audio",
              "video",
              "document",
              "sticker",
              "location",
              "contact",
            ].includes(rawType)
            ? rawType
            : innerPayload.hasMedia === true && kindFromMime
              ? kindFromMime
              : "text";

      const mediaObj =
        innerPayload.media && typeof innerPayload.media === "object"
          ? (innerPayload.media as Record<string, unknown>)
          : null;

      const bodyText = String(innerPayload.body ?? innerPayload.caption ?? "").trim() || `[${mappedType}]`;
      const source = typeof innerPayload.source === "string" && innerPayload.source.trim()
        ? innerPayload.source.trim().slice(0, 64)
        : undefined;

      const rawMessageId = innerPayload.id;
      const messageId =
        typeof rawMessageId === "string"
          ? rawMessageId
          : rawMessageId && typeof rawMessageId === "object"
            ? String(
                (rawMessageId as Record<string, unknown>)._serialized ??
                  (rawMessageId as Record<string, unknown>).id ??
                  eventId,
              )
            : eventId;
      const fromMe =
        typeof innerPayload.fromMe === "boolean"
          ? innerPayload.fromMe
          : Boolean(
              rawMessageId &&
                typeof rawMessageId === "object" &&
                (rawMessageId as Record<string, unknown>).fromMe === true,
            );

      const attached = innerPayload._ancora && typeof innerPayload._ancora === "object"
        ? innerPayload._ancora as Record<string, unknown>
        : {};
      const contactLidUnresolved = fromMe
        ? isUnresolvedLid(innerPayload.to, attached.toPn)
        : isUnresolvedLid(innerPayload.from, attached.fromPn);

      return {
        eventId,
        type: "message.inbound",
        sessionId,
        occurredAt,
        message: {
          id: messageId,
          from: contactJid(innerPayload.from, attached.fromPn),
          to: contactJid(innerPayload.to, attached.toPn) || undefined,
          ...(contactLidUnresolved ? { contactLidUnresolved: true } : {}),
          body: bodyText,
          type: mappedType,
          fromMe,
          source,
          caption: innerPayload.caption ? String(innerPayload.caption) : undefined,
          replyToId: (innerPayload.replyTo as Record<string, unknown>)?.id
            ? String((innerPayload.replyTo as Record<string, unknown>).id)
            : undefined,
          media: mediaObj
            ? {
                mimeType: String(mediaObj.mimetype || mediaObj.mimeType || "application/octet-stream"),
                fileName: mediaObj.filename ? String(mediaObj.filename) : undefined,
                sizeBytes: typeof mediaObj.sizeBytes === "number" ? mediaObj.sizeBytes : undefined,
                url: typeof mediaObj.url === "string" && mediaObj.url.trim() ? mediaObj.url.trim().slice(0, 2000) : undefined,
              }
            : undefined,
        },
      };
    }

    if (isNativeWahaSession) {
      const rawStatus = String(innerPayload.status || raw.sessionStatus || "").toUpperCase();
      // Fail-safe: status desconhecido nunca é "active". O default otimista
      // marcava sessões em pareamento (SCAN_QR_CODE/AUTHENTICATING) como
      // prontas no banco, fazendo a conexão oscilar ready↔disconnected.
      // Pareamento também não é "offline": marcar SCAN_QR_CODE/STARTING como
      // desconectado sobrescrevia "conectando" no banco e derrubava a UI.
      let sessionStatus: "active" | "connecting" | "paused" | "offline" | "error" = "offline";
      if (rawStatus === "WORKING" || rawStatus === "CONNECTED" || rawStatus === "ACTIVE") {
        sessionStatus = "active";
      } else if (rawStatus === "PAUSED") {
        sessionStatus = "paused";
      } else if (rawStatus === "FAILED" || rawStatus === "ERROR") {
        sessionStatus = "error";
      } else if (["STARTING", "SCAN_QR_CODE", "AUTHENTICATING", "OPENING", "CONNECTING"].includes(rawStatus)) {
        sessionStatus = "connecting";
      }

      return {
        eventId,
        type: "session.status",
        sessionId,
        occurredAt,
        sessionStatus,
      };
    }

    if (isNativeWahaAck) {
      const ackVal = innerPayload.ack;
      const status: "sent" | "delivered" | "read" | "failed" =
        ackVal === 3
          ? "read"
          : ackVal === 2
            ? "delivered"
            : ackVal === 1
              ? "sent"
              : "delivered";

      return {
        eventId,
        type: "message.status",
        sessionId,
        occurredAt,
        delivery: {
          idempotencyKey: String(innerPayload.idempotencyKey || innerPayload.id || eventId),
          providerMessageId: String(innerPayload.id || ""),
          status,
        },
      };
    }
  }

  const message = raw.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) return raw;

  return {
    ...raw,
    message: {
      ...(message as Record<string, unknown>),
      from: normalizeJid((message as Record<string, unknown>).from),
      to: normalizeJid((message as Record<string, unknown>).to),
    },
  };
}

import { normalizePhone } from "@/shared/utils/phone";
export { normalizePhone };

export function phoneHash(value: string) {
  return createHash("sha256").update(normalizePhone(value)).digest("hex");
}

export function relaySignature(secret: string, timestamp: string, nonce: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${rawBody}`).digest("hex");
}

export function verifyRelaySignature(input: { secret: string; timestamp: string | null; nonce: string | null; signature: string | null; rawBody: string; maxAgeMs?: number }) {
  if (!input.timestamp || !input.nonce || !input.signature) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > (input.maxAgeMs ?? 5 * 60_000)) return false;
  const expected = relaySignature(input.secret, input.timestamp, input.nonce, input.rawBody);
  const received = Buffer.from(input.signature, "hex");
  const target = Buffer.from(expected, "hex");
  return received.length === target.length && received.length > 0 && timingSafeEqual(received, target);
}
