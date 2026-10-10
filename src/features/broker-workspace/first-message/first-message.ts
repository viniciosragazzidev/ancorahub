/**
 * The first message of a lead sent from the computer (decision 2026-10-10):
 * only the first one goes through the broker's own WhatsApp (WAHA), once per
 * lead and with an hourly cap; the conversation then continues on the phone.
 */

export const FIRST_MESSAGE_MAX_LENGTH = 1_000;
/** First messages a broker may send through the system per hour (the number's safety). */
export const FIRST_MESSAGES_PER_HOUR = 20;

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** "Olá, Maria! Aqui é o Carlos, da Âncora Saúde..." (no dash, editable by the broker). */
export function buildFirstMessage(input: { leadName: string | null; brokerName: string | null; companyName: string | null }) {
  const lead = firstName(input.leadName);
  const broker = firstName(input.brokerName);
  const company = (input.companyName ?? "").trim();
  const greeting = lead ? `Olá, ${lead}!` : "Olá!";
  const intro = broker ? ` Aqui é ${broker}${company ? `, da ${company}` : ""}.` : company ? ` Aqui é da ${company}.` : "";
  return `${greeting}${intro} Recebi seu pedido sobre plano de saúde e vou te ajudar a encontrar a melhor opção. Podemos conversar por aqui?`;
}

/** WhatsApp Web with the number and the text already written (the broker only presses Enter). */
export function buildWhatsAppWebUrl(phoneDigits: string, text?: string) {
  const query = new URLSearchParams({ phone: phoneDigits });
  if (text) query.set("text", text);
  return `https://web.whatsapp.com/send?${query.toString()}`;
}
