import {
  getMediaLimitBytes,
  isConversationMediaEnabled,
  mediaKindAcceptsMime,
  storeConversationMedia,
  type ConversationMediaKind,
  type ConversationMediaMetadata,
} from "@/features/communication-channels/conversation-media";
import { downloadWahaMedia } from "./relay-client";

/** `/api/files/…` from a WAHA media link (the only kind of path the relay downloads). */
export function wahaFilePath(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const pathname = new URL(url, "http://waha.local").pathname;
    return pathname.startsWith("/api/files/") && !pathname.includes("..") ? pathname : null;
  } catch {
    return null;
  }
}

/** WAHA message types that carry a file the conversation can play or open. */
export function wahaMessageMediaKind(type: string | undefined): ConversationMediaKind | null {
  if (type === "audio" || type === "image" || type === "video" || type === "document") return type;
  if (type === "sticker") return "image";
  return null;
}

/**
 * Downloads the file WAHA stored for a message (through the relay) and keeps
 * it in the conversation media storage, so the lead conversation shows the
 * audio/image/document instead of a "[audio]" placeholder. Returns null when
 * there is nothing to store or the download fails — the message itself is
 * still recorded.
 */
export async function storeWahaMessageMedia(input: {
  tenantId: string;
  messageRowId: string;
  type: string | undefined;
  media: { url?: string; providerPath?: string; mimeType?: string; fileName?: string } | undefined;
}): Promise<ConversationMediaMetadata | null> {
  const kind = wahaMessageMediaKind(input.type);
  const providerPath = input.media?.providerPath ?? wahaFilePath(input.media?.url);
  if (!kind || !providerPath) return null;
  if (!(await isConversationMediaEnabled())) return null;
  try {
    const file = await downloadWahaMedia(providerPath);
    const declaredMime = input.media?.mimeType?.split(";")[0]?.trim();
    const mimeType = declaredMime && declaredMime !== "application/octet-stream" ? declaredMime : file.contentType;
    if (!mediaKindAcceptsMime(kind, mimeType) || file.body.byteLength > getMediaLimitBytes(kind)) {
      console.warn("[waha-media] rejected", { kind, mimeType, bytes: file.body.byteLength });
      return null;
    }
    return await storeConversationMedia({
      tenantId: input.tenantId,
      messageId: input.messageRowId,
      kind,
      mimeType,
      filename: input.media?.fileName ?? null,
      body: file.body,
    });
  } catch (error) {
    console.warn("[waha-media] download_failed", { kind, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return null;
  }
}
