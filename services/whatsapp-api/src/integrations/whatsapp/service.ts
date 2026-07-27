import { postMetaMessage } from "./client.js";
import { buildMetaTextPayload, normalizeTestMessage } from "./messages.js";
import type { SendTestMessageInput, SendTestMessageResult, WhatsAppReviewConfig } from "./types.js";

export async function sendTestMessage(config: WhatsAppReviewConfig, input: SendTestMessageInput): Promise<SendTestMessageResult> {
  if (!config.reviewEnabled) throw new Error("O envio de revisão está desativado.");
  const normalized = normalizeTestMessage(input);
  const response = await postMetaMessage(config, buildMetaTextPayload(normalized));
  const messageId = response.messages?.[0]?.id;
  if (!messageId) throw new Error("A Meta não retornou o identificador da mensagem.");
  return { messageId };
}
