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
}).strict();

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
    /** Caption for media messages */
    caption: z.string().max(1_000).optional(),
    /** Reply context: the ID of the message being replied to */
    replyToId: z.string().max(200).optional(),
    /** Media metadata */
    media: z.object({
      mimeType: z.string().max(100).optional(),
      fileName: z.string().max(255).optional(),
      sizeBytes: z.number().int().optional(),
    }).strict().optional(),
  }).strict().optional(),
  delivery: z.object({
    idempotencyKey: z.string().min(16).max(160),
    providerMessageId: z.string().min(1).max(200).optional(),
    status: z.enum(["sent", "delivered", "read", "failed"]),
  }).strict().optional(),
  sessionStatus: z.enum(["active", "paused", "offline", "error"]).optional(),
}).strict();

export type WahaWebhookEvent = z.infer<typeof wahaWebhookSchema>;

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

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
