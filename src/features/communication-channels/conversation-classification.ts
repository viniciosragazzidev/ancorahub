import { matchesKnownBrokerPhone } from "./service";

type SyntheticCustomerCandidate = {
  leadId: string | null;
  phone: string | null;
};

export function shouldCreateSyntheticCustomerConversation(
  message: SyntheticCustomerCandidate,
  leadPhones: ReadonlySet<string>,
  brokerPhones: readonly string[],
) {
  if (message.leadId || !message.phone) return false;
  if (matchesKnownBrokerPhone(message.phone, brokerPhones)) return false;

  const clean = message.phone.replace(/\D/g, "");
  if (!clean) return false;

  return !leadPhones.has(clean) && !leadPhones.has(clean.slice(-11));
}
