import { samePhoneSubscriber } from "@/features/waha-cadence/phone-matching";
import { normalizePhone } from "@/shared/utils/phone";

import { isStatusBroadcastMessage } from "./status-broadcast";

/**
 * "Número oficial · corretores" shows what a broker sent to the company: the
 * official Meta number and the company WAHA numbers (brokers also write to the
 * diretoria number). Two kinds of stored rows are not a broker writing:
 * - chatter between the tenant's own company numbers (21/10: the materials
 *   number received "safado, nem deixou eu fazer a troca" from the diretoria
 *   number, which is also the phone of the member profile "Plantão Corretor");
 * - WhatsApp Status/stories (`status@broadcast`) a broker posted, which the
 *   company sessions see but nobody sent to the company.
 */
export function isOfficialBrokerChannelInbound(
  row: { phone: string; messageId?: string | null },
  companyPhones: ReadonlyArray<string>,
) {
  if (isStatusBroadcastMessage(row)) return false;
  return !isCompanyPhone(row.phone, companyPhones);
}

/** Whether the phone is one of the tenant's own numbers (with or without 55 and the 9th digit). */
export function isCompanyPhone(phone: string, companyPhones: ReadonlyArray<string>) {
  return companyPhones.some((company) => samePhoneSubscriber(company, phone));
}

/** The company numbers that are real phones (a pending WAHA session shows "Pendente (…)"). */
export function companyPhoneList(displayPhones: ReadonlyArray<string | null>) {
  return displayPhones.flatMap((value) => {
    const digits = normalizePhone(value);
    return digits.length >= 10 ? [digits] : [];
  });
}

/**
 * Suffix used to pre-filter a broker's rows in SQL. The last 8 digits survive
 * the country code, the DDD and the Brazilian ninth digit; the exact match is
 * then confirmed in memory. (Four digits matched unrelated numbers.)
 */
export function officialBrokerPhoneSuffix(normalizedPhone: string) {
  return normalizedPhone.length >= 8 ? normalizedPhone.slice(-8) : null;
}
