import type { LightLeadDetailData } from "./components/light-lead-detail/types";

const NEW_LEAD_STATUSES = ["distributed", "new"];

/**
 * Contact data (phone, e-mail) of a lead reaches the Light client only after the
 * logged broker owns the lead and has accepted it. Same rule the UI uses to show
 * "Ligar" and "WhatsApp", applied on the server so the data is not in the payload.
 */
export function canRevealLightContact(input: { status: string; isCurrentBroker: boolean }) {
  return input.isCurrentBroker && !NEW_LEAD_STATUSES.includes(input.status);
}

const CONTACT_KEY = /(e-?mail|tel|fone|phone|whats|celular|contato)/i;

type ClientInfo = NonNullable<LightLeadDetailData["clientInfo"]>;

/** Removes any client-info row that could carry a phone or e-mail while contact is hidden. */
export function redactClientInfo(items: ClientInfo): ClientInfo {
  return items.filter((item) => !CONTACT_KEY.test(item.key) && !CONTACT_KEY.test(item.label));
}

/** Contact fields for the Light payload: real values after acceptance, null before. */
export function lightContactFields<T extends { telefone: string | null; email?: string | null }>(
  lead: T,
  state: { status: string; isCurrentBroker: boolean },
) {
  const reveal = canRevealLightContact(state);
  return { reveal, telefone: reveal ? lead.telefone : null, email: reveal ? (lead.email ?? null) : null };
}
