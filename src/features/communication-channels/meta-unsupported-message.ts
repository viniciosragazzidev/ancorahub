import type { MetaWebhookMessage } from "./types";

/**
 * A customer message Meta delivers as "unsupported": the customer sees it on
 * the phone, but the API gets no content, only Meta's error (often 131051,
 * "Message type unknown") and, from an ad, its referral. The message is kept
 * with what Meta said, so the conversation shows it and the cause is known.
 */
export function describeUnsupportedMessage(message: Pick<MetaWebhookMessage, "errors" | "unsupported" | "referral">) {
  const error = message.errors?.[0];
  const code = error?.code ? String(error.code) : null;
  const reason = [error?.title, error?.error_data?.details ?? error?.message].filter((part, index, all) => part && all.indexOf(part) === index).join(": ");
  const kind = message.unsupported?.type ? `tipo ${message.unsupported.type}` : null;
  const fromAd = message.referral?.source_type ? `veio de anúncio${message.referral.headline ? ` "${message.referral.headline}"` : ""}` : null;
  const facts = [code ? `erro ${code}` : null, reason || null, kind, fromAd].filter(Boolean).join(" · ");
  return {
    text: `⚠️ O cliente mandou uma mensagem que a Meta não entrega pelo sistema${facts ? ` (${facts})` : ""}. Veja o conteúdo no celular do número.`,
    /** Kept on the webhook event: "unsupported:131051". */
    errorCode: `unsupported${code ? `:${code}` : ""}`.slice(0, 64),
  };
}
