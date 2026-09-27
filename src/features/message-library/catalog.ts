/**
 * Message library (service engine phase 2): every message the system can say,
 * with its kind stated and where it is valid. Pure, no I/O.
 *
 * - Meta template: approved by Meta; the only thing Meta delivers outside the
 *   24-hour customer service window. Not used by the company number.
 * - Free message: plain text. On Meta only inside the 24-hour window (after
 *   the person wrote); through the company number (WAHA) at any time.
 * - AI quick reply: fixed answer the AI sends inside a conversation.
 */
export type MessageKind = "meta_template" | "free_message" | "quick_reply";

export type ChannelValidity = { channel: "meta" | "company_number"; label: string; valid: "always" | "window" | "never" };

export const MESSAGE_KIND_LABEL: Record<MessageKind, string> = {
  meta_template: "Template Meta",
  free_message: "Mensagem livre",
  quick_reply: "Resposta rápida da IA",
};

export function channelValidity(kind: MessageKind): ChannelValidity[] {
  switch (kind) {
    case "meta_template":
      return [
        { channel: "meta", label: "Meta: a qualquer hora", valid: "always" },
        { channel: "company_number", label: "WhatsApp da empresa: não se aplica", valid: "never" },
      ];
    case "free_message":
      return [
        { channel: "meta", label: "Meta: só na janela de 24h", valid: "window" },
        { channel: "company_number", label: "WhatsApp da empresa: a qualquer hora", valid: "always" },
      ];
    case "quick_reply":
      return [
        { channel: "meta", label: "Meta: dentro da conversa", valid: "window" },
        { channel: "company_number", label: "WhatsApp da empresa: dentro da conversa", valid: "window" },
      ];
  }
}

/** A place that uses a message; deleting or deactivating it changes what that place sends. */
export type MessageUsage = { area: "team_notice" | "situation" | "follow_up" | "ai"; label: string };

export function describeUsages(usages: readonly MessageUsage[]) {
  return usages.map((usage) => usage.label).join(" · ");
}
