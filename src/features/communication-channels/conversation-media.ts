import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq, or } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object, uploadR2Object } from "@/shared/storage/r2-storage";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { decryptChannelSecret } from "./secret-crypto";
import { getMetaCloudServerConfig } from "./meta-cloud-config";

export const CONVERSATION_MEDIA_R2_PREFIX = "whatsapp-media";

/** Canonical media kinds supported in official conversations (DEC-098). */
export const CONVERSATION_MEDIA_KINDS = ["image", "audio", "video", "document"] as const;
export type ConversationMediaKind = (typeof CONVERSATION_MEDIA_KINDS)[number];

/** Meta Cloud API official size limits per message type. */
export const CONVERSATION_MEDIA_LIMITS = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const satisfies Record<ConversationMediaKind, number>;

const MIME_PREFIX_BY_KIND: Record<ConversationMediaKind, readonly string[]> = {
  image: ["image/"],
  audio: ["audio/", "application/ogg"],
  video: ["video/"],
  document: [],
};

export type ConversationMediaMetadata = {
  kind: ConversationMediaKind;
  mimeType: string;
  filename: string | null;
  sizeBytes: number;
  storageKey: string;
  providerId: string | null;
  sha256: string;
};

export function isConversationMediaEnabled(): Promise<boolean> {
  return getFeatureFlag(FEATURE_FLAGS.CONVERSATION_MEDIA).then((value) => value !== "false");
}

export function normalizeMediaKind(rawKind: string | null | undefined): ConversationMediaKind | null {
  return CONVERSATION_MEDIA_KINDS.includes((rawKind ?? "") as ConversationMediaKind)
    ? (rawKind as ConversationMediaKind)
    : null;
}

/** Media kinds accepted inside Meta webhook payloads. */
export function isMetaInboundMediaKind(kind: string | null | undefined) {
  return (
    normalizeMediaKind(kind) !== null ||
    kind === "sticker" ||
    (kind ?? "").startsWith("audio/") ||
    kind === "voice"
  );
}

export function mediaKindAcceptsMime(kind: ConversationMediaKind, mimeType: string) {
  const normalized = mimeType.toLowerCase();
  const prefixes = MIME_PREFIX_BY_KIND[kind];
  return prefixes.length === 0 || prefixes.some((prefix) => normalized.startsWith(prefix));
}

export function getMediaLimitBytes(kind: ConversationMediaKind) {
  return CONVERSATION_MEDIA_LIMITS[kind];
}

export function buildConversationMediaStorageKey(input: { tenantId: string; messageId: string; kind: ConversationMediaKind; mimeType: string }) {
  const extension = guessExtension(input.kind, input.mimeType);
  return `${CONVERSATION_MEDIA_R2_PREFIX}/${input.tenantId}/${input.messageId}-${randomUUID().slice(0, 8)}${extension}`;
}

function guessExtension(kind: ConversationMediaKind, mimeType: string) {
  const normalized = mimeType.toLowerCase();
  const table: Record<ConversationMediaKind, Record<string, string>> = {
    image: { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" },
    audio: { "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/ogg; codecs=opus": ".ogg", "application/ogg": ".ogg", "audio/amr": ".amr", "audio/aac": ".aac" },
    video: { "video/mp4": ".mp4", "video/3gpp": ".3gp", "video/webm": ".webm" },
    document: { "application/pdf": ".pdf", "application/msword": ".doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx", "application/vnd.ms-excel": ".xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx", "text/plain": ".txt", "text/csv": ".csv" },
  };
  return table[kind][normalized] ?? "";
}

/**
 * Validates an outbound media upload at the server boundary.
 * Never trust filename or extension: the decision uses the declared MIME type.
 */
export function validateOutboundMedia(input: {
  kind: string;
  mimeType: string;
  sizeBytes: number;
}): { ok: true; kind: ConversationMediaKind } | { ok: false; error: string } {
  const kind = normalizeMediaKind(input.kind);
  if (!kind) return { ok: false, error: "Tipo de mídia não suportado." };
  if (!input.mimeType) return { ok: false, error: "Selecione um arquivo válido." };
  if (!mediaKindAcceptsMime(kind, input.mimeType)) {
    return { ok: false, error: `O arquivo selecionado não é um ${kind === "document" ? "documento" : kind} válido.` };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "Arquivo vazio ou inválido." };
  }
  const limit = CONVERSATION_MEDIA_LIMITS[kind];
  if (input.sizeBytes > limit) {
    return { ok: false, error: `O arquivo excede o limite de ${Math.round(limit / (1024 * 1024))} MB para ${kind === "document" ? "documentos" : `${kind}s`}.` };
  }
  return { ok: true, kind };
}

export async function storeConversationMedia(input: {
  tenantId: string;
  messageId: string;
  kind: ConversationMediaKind;
  mimeType: string;
  filename: string | null;
  body: Buffer;
}): Promise<ConversationMediaMetadata> {
  const sha256 = createHash("sha256").update(input.body).digest("hex");
  const storageKey = buildConversationMediaStorageKey({
    tenantId: input.tenantId,
    messageId: input.messageId,
    kind: input.kind,
    mimeType: input.mimeType,
  });
  await uploadR2Object(storageKey, input.body, input.mimeType);
  return {
    kind: input.kind,
    mimeType: input.mimeType,
    filename: input.filename?.trim() || null,
    sizeBytes: input.body.byteLength,
    storageKey,
    providerId: null,
    sha256,
  };
}

/**
 * Downloads a media binary from the Meta Graph API using the channel's own
 * credential. The URL is validated to stay on Meta media hosts (defense in
 * depth: the CRM never fetches arbitrary URLs from webhook payloads).
 */
export async function downloadMetaMediaObject(input: {
  channel: Pick<typeof schema.communicationChannels.$inferSelect, "accessTokenCiphertext" | "phoneNumberId">;
  mediaId: string;
}): Promise<{ body: Buffer; mimeType: string; filename: string | null }> {
  if (!input.channel.accessTokenCiphertext) {
    throw new Error("Canal sem credencial para baixar a mídia.");
  }
  const accessToken = decryptChannelSecret(
    input.channel.accessTokenCiphertext,
    getMetaCloudServerConfig().tokenEncryptionKey,
  );

  const metadataResponse = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(input.mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!metadataResponse.ok) {
    throw new Error(`A Meta não devolveu os metadados da mídia (${metadataResponse.status}).`);
  }
  const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string; filename?: string };
  if (!metadata.url) {
    throw new Error("A mídia não está mais disponível na Meta.");
  }
  const parsed = new URL(metadata.url);
  if (parsed.hostname !== "lookaside.fbsbx.com" && !parsed.hostname.endsWith(".facebook.com")) {
    throw new Error("URL de mídia da Meta inválida.");
  }

  const binaryResponse = await fetch(parsed, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!binaryResponse.ok) {
    throw new Error(`Não foi possível baixar a mídia da Meta (${binaryResponse.status}).`);
  }
  const arrayBuffer = await binaryResponse.arrayBuffer();
  return {
    body: Buffer.from(arrayBuffer),
    mimeType: metadata.mime_type?.trim() || "application/octet-stream",
    filename: metadata.filename?.trim() || null,
  };
}

/**
 * Uploads a binary to the Meta Cloud API and returns the provider media id to
 * reference in the outgoing message payload.
 */
export async function uploadMetaMediaObject(input: {
  channel: Pick<typeof schema.communicationChannels.$inferSelect, "accessTokenCiphertext" | "phoneNumberId">;
  body: Buffer;
  mimeType: string;
  kind: ConversationMediaKind;
}): Promise<string> {
  if (!input.channel.phoneNumberId || !input.channel.accessTokenCiphertext) {
    throw new Error("Canal corporativo incompleto.");
  }
  const accessToken = decryptChannelSecret(
    input.channel.accessTokenCiphertext,
    getMetaCloudServerConfig().tokenEncryptionKey,
  );
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([new Uint8Array(input.body)], { type: input.mimeType }), guessUploadFilename(input.kind, input.mimeType));
  const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(input.channel.phoneNumberId)}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? `A Meta recusou o upload da mídia (${response.status}).`);
  }
  return payload.id;
}

function guessUploadFilename(kind: ConversationMediaKind, mimeType: string) {
  const fallback = { image: "imagem", audio: "audio", video: "video", document: "documento" }[kind];
  const extension = guessExtension(kind, mimeType) || (kind === "image" ? ".jpg" : kind === "video" ? ".mp4" : kind === "audio" ? ".ogg" : ".bin");
  return `${fallback}${extension}`;
}

/** Resolves a media message for an authorized viewer, tenant-scoped. */
export async function resolveConversationMediaForViewer(input: { messageId: string; viewer: { tenantId: string; userId: string; role: string; branchId: string | null } }) {
  const db = getDatabase();
  const [message] = await db
    .select({
      id: schema.whatsappMessages.id,
      tenantId: schema.whatsappMessages.tenantId,
      leadId: schema.whatsappMessages.leadId,
      phone: schema.whatsappMessages.phone,
      mediaKind: schema.whatsappMessages.mediaKind,
      mediaMimeType: schema.whatsappMessages.mediaMimeType,
      mediaFilename: schema.whatsappMessages.mediaFilename,
      mediaStorageKey: schema.whatsappMessages.mediaStorageKey,
    })
    .from(schema.whatsappMessages)
    .where(
      and(
        eq(schema.whatsappMessages.id, input.messageId),
        eq(schema.whatsappMessages.tenantId, input.viewer.tenantId),
      ),
    )
    .limit(1);
  if (!message?.mediaKind || !message.mediaStorageKey) return null;

  if (message.leadId) {
    const [lead] = await db
      .select({ corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, message.leadId), eq(schema.leads.tenantId, input.viewer.tenantId)))
      .limit(1);
    if (!lead) return null;
    if (input.viewer.role === "broker" && lead.corretorId !== input.viewer.userId) return null;
    if (input.viewer.role === "manager" && lead.branchId && input.viewer.branchId && lead.branchId !== input.viewer.branchId) return null;
  } else {
    // Broker-channel media (aba Corretores / internal). Only management roles
    // consult this history through the workspace; brokers read their own chats
    // in the app, never in the CRM (DEC-091).
    if (input.viewer.role === "broker") {
      const [profile] = await db
        .select({ phone: schema.brokerProfiles.phone })
        .from(schema.brokerProfiles)
        .where(and(eq(schema.brokerProfiles.tenantId, input.viewer.tenantId), eq(schema.brokerProfiles.userId, input.viewer.userId)))
        .limit(1);
      if (!profile?.phone || !or(eq(schema.whatsappMessages.phone, profile.phone), eq(schema.whatsappMessages.phone, profile.phone))) return null;
    }
  }

  return message;
}

export async function downloadConversationMediaObject(storageKey: string) {
  if (!storageKey.startsWith(`${CONVERSATION_MEDIA_R2_PREFIX}/`)) {
    throw new Error("Chave de armazenamento de mídia inválida.");
  }
  return downloadR2Object(storageKey);
}

export function mediaMetadataFromMessage(message: {
  mediaKind: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  mediaSizeBytes: number | null;
  mediaStorageKey: string | null;
}) {
  if (!message.mediaKind || !message.mediaStorageKey) return null;
  return {
    kind: message.mediaKind as ConversationMediaKind,
    mimeType: message.mediaMimeType ?? "application/octet-stream",
    filename: message.mediaFilename,
    sizeBytes: message.mediaSizeBytes,
    storageKey: message.mediaStorageKey,
  };
}
