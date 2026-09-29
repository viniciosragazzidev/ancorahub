/**
 * Pure readers for the webhook fields of a WhatsApp Business app number in
 * coexistence (Meta: smb_message_echoes, history, smb_app_state_sync,
 * account_update). None of these is a customer writing now: they are never
 * handed to the AI, lead intake or offers.
 */
export const COEXISTENCE_WEBHOOK_FIELDS = new Set(["smb_message_echoes", "history", "smb_app_state_sync", "account_update"]);

type RawMessage = {
  from?: string;
  to?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  [key: string]: unknown;
};

export type CoexistenceMessage = {
  providerMessageId: string;
  /** The customer's number (the other side of the chat). */
  customerPhone: string;
  /** "outgoing" when the business wrote it (in the app), "incoming" when the customer did. */
  direction: "incoming" | "outgoing";
  body: string;
  sentAt: Date;
};

const digits = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

function messageBody(message: RawMessage) {
  const text = message.type === "text" ? message.text?.body?.trim() : undefined;
  if (text) return text.slice(0, 4096);
  const caption = message.type ? (message[message.type] as { caption?: string } | undefined)?.caption?.trim() : undefined;
  return caption ? `[${message.type}] ${caption.slice(0, 4000)}` : `[${message.type ?? "mensagem"}]`;
}

function sentAt(timestamp: string | undefined) {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

/** Messages a person sent from the WhatsApp Business app (or its companion devices). */
export function readMessageEchoes(value: { message_echoes?: RawMessage[] } | undefined): CoexistenceMessage[] {
  return (value?.message_echoes ?? []).flatMap((message) => {
    const customerPhone = digits(message.to);
    if (!message.id || customerPhone.length < 8) return [];
    return [{ providerMessageId: message.id, customerPhone, direction: "outgoing" as const, body: messageBody(message), sentAt: sentAt(message.timestamp) }];
  });
}

type HistoryChunk = {
  metadata?: { phase?: number; chunk_order?: number; progress?: number };
  threads?: Array<{ id?: string; messages?: RawMessage[] }>;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

/**
 * Past messages of each chat. `from` is the business or the customer; the
 * thread id is always the customer. A declined sharing arrives as errors.
 */
export function readHistory(value: { history?: HistoryChunk[] } | undefined, businessPhone: string | null | undefined) {
  const business = digits(businessPhone ?? "");
  const messages: CoexistenceMessage[] = [];
  const errors: string[] = [];
  let progress: number | null = null;
  for (const chunk of value?.history ?? []) {
    for (const error of chunk.errors ?? []) errors.push((error.title ?? error.message ?? `Erro ${error.code ?? ""}`).slice(0, 200));
    if (typeof chunk.metadata?.progress === "number") progress = Math.max(progress ?? 0, chunk.metadata.progress);
    for (const thread of chunk.threads ?? []) {
      const customerPhone = digits(thread.id);
      if (customerPhone.length < 8) continue;
      for (const message of thread.messages ?? []) {
        if (!message.id) continue;
        const from = digits(message.from);
        const fromBusiness = business ? from.endsWith(business.slice(-8)) : from !== customerPhone;
        messages.push({ providerMessageId: message.id, customerPhone, direction: fromBusiness ? "outgoing" : "incoming", body: messageBody(message), sentAt: sentAt(message.timestamp) });
      }
    }
  }
  return { messages, errors, progress };
}

/** Contacts of the app: counted only (the CRM has no contact book to fill). */
export function countStateSyncContacts(value: { state_sync?: Array<{ type?: string }> } | undefined) {
  return (value?.state_sync ?? []).filter((item) => item.type === "contact").length;
}

/** The business disconnected the CRM from inside the WhatsApp Business app. */
export function readPartnerRemoved(value: { event?: string; phone_number?: string } | undefined) {
  return value?.event === "PARTNER_REMOVED" ? { phone: digits(value.phone_number) } : null;
}
