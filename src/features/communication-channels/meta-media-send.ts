import "server-only";

import type { ConversationMediaKind } from "./conversation-media";
import { formatE164Phone } from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { decryptChannelSecret } from "./secret-crypto";

const MEDIA_MESSAGES_ENDPOINT = "https://graph.facebook.com/v23.0";

/**
 * Envia uma mídia já enviada à Meta (`uploadMetaMediaObject`) para um contato. Usado pelo envio manual
 * da conversa (`send-lead-media.ts`) e pelo outbox de documento da Venda Automatizada.
 */
export async function sendMetaCloudMediaMessage(input: {
  channel: { accessTokenCiphertext: string | null; phoneNumberId: string | null };
  to: string;
  kind: ConversationMediaKind;
  providerMediaId: string;
  caption?: string;
  filename?: string;
}) {
  const accessToken = decryptChannelSecret(input.channel.accessTokenCiphertext ?? "", getMetaCloudServerConfig().tokenEncryptionKey);
  const mediaPayload: Record<string, unknown> = { id: input.providerMediaId };
  if (input.caption) mediaPayload.caption = input.caption;
  if (input.filename) mediaPayload.filename = input.filename;

  const response = await fetch(`${MEDIA_MESSAGES_ENDPOINT}/${encodeURIComponent(input.channel.phoneNumberId ?? "")}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formatE164Phone(input.to),
      type: input.kind,
      [input.kind]: mediaPayload,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string; code?: number } };
  if (!response.ok || !payload.messages?.[0]?.id) {
    const error = new Error(payload.error?.message ?? "A Meta recusou o envio da mídia.") as Error & { metaCode?: number };
    error.metaCode = payload.error?.code;
    throw error;
  }
  return { messageId: payload.messages[0].id };
}
