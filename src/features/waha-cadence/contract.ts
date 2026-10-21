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
    /**
     * The chat is a WhatsApp group (`@g.us`). `from`/`to` then hold the group
     * id digits, not a contact phone, and the message must never create a lead.
     */
    isGroup: z.boolean().optional(),
    /** The group id (the part before `@g.us`), only for group messages. */
    groupId: z.string().min(1).max(100).optional(),
    /**
     * A WhatsApp Status/story (chat `status@broadcast`): what a contact posted
     * for all their contacts, never a message to the company. Ingest ignores it.
     */
    isStatusBroadcast: z.boolean().optional(),
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
/** WAHA message types that are session/protocol events, never something the contact wrote. */
const WAHA_PROTOCOL_TYPES = new Set([
  "revoked",
  "protocol",
  "e2e_notification",
  "notification",
  "notification_template",
  "call_log",
  "gp2",
  "reaction",
  "broadcast_notification",
]);

export function normalizeWahaWebhookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const raw = payload as Record<string, unknown>;

  const normalizeJid = (value: unknown) =>
    typeof value === "string" ? value.replace(/@[^\s]+$/, "").replace(/\D/g, "") : value;
  // Group chats end in `@g.us`. Detect them before normalizeJid strips the suffix.
  const isGroupJid = (value: unknown) => typeof value === "string" && value.endsWith("@g.us");
  // In a group, `from`/`to` hold the group id, which is not a phone. The sender
  // (participant) is the phone that goes in `from`; the group id is never `to`.
  const groupFields = (chat: unknown, to: unknown) => {
    const jid = isGroupJid(chat) ? chat : isGroupJid(to) ? to : null;
    return typeof jid === "string" ? { isGroup: true, groupId: jid.replace(/@g\.us$/, "") } : {};
  };
  // A group sender is often a privacy id (`@lid`) the relay does not resolve, so its digits can be
  // longer than a phone. Keep the last 15: it only identifies the author (stored as a hash).
  const groupAuthorJid = (chat: unknown, participant: unknown) => {
    if (!isGroupJid(chat) || typeof participant !== "string" || !participant.trim()) return undefined;
    const digits = String(normalizeJid(participant));
    return digits.length > 15 ? digits.slice(-15) : digits;
  };
  // An `@lid` is a privacy id, not a phone: prefer the phone the relay
  // attached (`payload._ancora.{from,to}Pn`, see whatsapp-api lid.ts).
  const contactJid = (value: unknown, phone: unknown) =>
    typeof value === "string" && value.endsWith("@lid") && typeof phone === "string" && phone.trim()
      ? normalizeJid(phone)
      : normalizeJid(value);
  // WhatsApp Status/stories live on the chat `status@broadcast`; the poster is the participant.
  const isStatusJid = (value: unknown) => typeof value === "string" && value.toLowerCase().includes("status@broadcast");
  const isStatusMessage = (message: Record<string, unknown>, messageId: unknown) => {
    const data = message._data && typeof message._data === "object" ? message._data as Record<string, unknown> : {};
    const dataId = data.id && typeof data.id === "object" ? data.id as Record<string, unknown> : {};
    return isStatusJid(message.from) || isStatusJid(message.to) || isStatusJid(message.chatId)
      || isStatusJid(messageId) || isStatusJid(dataId.remote) || isStatusJid(dataId._serialized)
      || message.isStatus === true || data.isStatusV3 === true;
  };
  // The poster of a status, so the event still validates and can be marked ignored.
  const statusAuthor = (message: Record<string, unknown>, phone: unknown) => {
    const participant = message.participant ?? message.author;
    const digits = String(contactJid(typeof participant === "string" ? participant : "", phone) ?? "");
    return digits ? (digits.length > 15 ? digits.slice(-15) : digits) : undefined;
  };
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

      // Without text, "[text]" marks a session/protocol event (deleted message,
      // security-code notice, call log, reaction) that ingest ignores. Any other
      // textless type (button/list reply, poll vote, undecrypted stub) may be the
      // contact writing, so it is kept as "[unsupported]" and shown as such.
      const textless = mappedType === "text" && rawType !== "chat" && !WAHA_PROTOCOL_TYPES.has(rawType)
        ? "[unsupported]"
        : `[${mappedType}]`;
      const bodyText = String(innerPayload.body ?? innerPayload.caption ?? "").trim() || textless;
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
      // WEBJS serializes the id as "true_<chat>_<id>" for the session owner's
      // own messages; without this an echo of the broker's message would be
      // read as the contact writing.
      const fromMe =
        typeof innerPayload.fromMe === "boolean"
          ? innerPayload.fromMe
          : rawMessageId && typeof rawMessageId === "object"
            ? (rawMessageId as Record<string, unknown>).fromMe === true ||
              String((rawMessageId as Record<string, unknown>)._serialized ?? "").startsWith("true_")
            : typeof rawMessageId === "string" && rawMessageId.startsWith("true_");

      const attached = innerPayload._ancora && typeof innerPayload._ancora === "object"
        ? innerPayload._ancora as Record<string, unknown>
        : {};
      const contactLidUnresolved = fromMe
        ? isUnresolvedLid(innerPayload.to, attached.toPn)
        : isUnresolvedLid(innerPayload.from, attached.fromPn);
      const isStatusBroadcast = isStatusMessage(innerPayload, messageId);

      return {
        eventId,
        type: "message.inbound",
        sessionId,
        occurredAt,
        message: {
          id: messageId,
          from:
            (isStatusBroadcast && isStatusJid(innerPayload.from) ? statusAuthor(innerPayload, attached.fromPn) : undefined) ??
            groupAuthorJid(innerPayload.from, innerPayload.participant ?? innerPayload.author) ??
            contactJid(innerPayload.from, attached.fromPn),
          to: isGroupJid(innerPayload.to) || isStatusJid(innerPayload.to) ? undefined : contactJid(innerPayload.to, attached.toPn) || undefined,
          ...(contactLidUnresolved ? { contactLidUnresolved: true } : {}),
          ...(isStatusBroadcast ? { isStatusBroadcast: true } : {}),
          ...groupFields(innerPayload.from, innerPayload.to),
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
  const preformatted = message as Record<string, unknown>;
  const preformattedStatus = isStatusMessage(preformatted, preformatted.id);

  return {
    ...raw,
    message: {
      ...preformatted,
      ...(preformattedStatus ? { isStatusBroadcast: true } : {}),
      from:
        (preformattedStatus && isStatusJid(preformatted.from) ? statusAuthor(preformatted, undefined) : undefined) ??
        groupAuthorJid(
          (message as Record<string, unknown>).from,
          (message as Record<string, unknown>).participant ?? (message as Record<string, unknown>).author,
        ) ?? normalizeJid((message as Record<string, unknown>).from),
      to: isGroupJid((message as Record<string, unknown>).to) || isStatusJid((message as Record<string, unknown>).to)
        ? undefined
        : normalizeJid((message as Record<string, unknown>).to),
      ...groupFields((message as Record<string, unknown>).from, (message as Record<string, unknown>).to),
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
