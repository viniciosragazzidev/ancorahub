/**
 * The first message of a lead sent from the computer (decision 2026-10-10):
 * only the first one goes through the broker's own WhatsApp (WAHA), once per
 * lead and with an hourly cap; the conversation then continues on the phone.
 */

import { brokerGreeting } from "@/features/leads/broker-greeting";

export const FIRST_MESSAGE_MAX_LENGTH = 1_000;
/** First messages a broker may send through the system per hour (the number's safety). */
export const FIRST_MESSAGES_PER_HOUR = 20;

/** The broker's first message (one text for every path since 29/10, see broker-greeting). */
export function buildFirstMessage(input: { leadName: string | null; brokerName: string | null; companyName: string | null }) {
  return brokerGreeting(input);
}

/** WhatsApp Web with the number and the text already written (the broker only presses Enter). */
export { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
