import { normalizePhone } from "@/shared/utils/phone";

/**
 * Identificador estável do assinante para reconciliação de histórico WAHA.
 * O DDD pode divergir entre o cadastro do lead e o chat real; os nove últimos
 * dígitos são o número móvel e não carregam essa divergência.
 */
export function phoneSubscriberSuffix(value?: string | null): string {
  const digits = normalizePhone(value);
  return digits.length >= 9 ? digits.slice(-9) : "";
}

/** DDD + number for a Brazilian phone (10 digits = legacy 8-digit mobile/landline, 11 = 9-digit mobile), else null. */
function brazilNational(value?: string | null): string | null {
  let digits = normalizePhone(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/**
 * The same Brazilian mobile written the other way around the 9th digit
 * (DDD + 8 digits ↔ DDD + 9 + 8 digits). WhatsApp still addresses many
 * numbers by the old 8-digit JID while the lead was registered with the 9,
 * so the 9-digit suffix alone never matched and the client's replies were
 * dropped. Null when there is no such variant.
 */
export function brazilNinthDigitVariant(value?: string | null): string | null {
  const national = brazilNational(value);
  if (!national) return null;
  if (national.length === 10) return /^[6-9]/.test(national.slice(2)) ? `${national.slice(0, 2)}9${national.slice(2)}` : null;
  return national[2] === "9" ? `${national.slice(0, 2)}${national.slice(3)}` : null;
}

export function samePhoneSubscriber(left?: string | null, right?: string | null): boolean {
  const leftSuffix = phoneSubscriberSuffix(left);
  const rightSuffix = phoneSubscriberSuffix(right);
  if (leftSuffix && rightSuffix && leftSuffix === rightSuffix) return true;
  // Only across the 9th-digit difference, and then the DDD must match too:
  // 8 digits alone are too short to identify a subscriber nationwide.
  const leftNational = brazilNational(left);
  const rightNational = brazilNational(right);
  if (!leftNational || !rightNational || leftNational.length === rightNational.length) return false;
  return brazilNinthDigitVariant(leftNational) === rightNational;
}

/**
 * Coarse shape of a contact number — never the number itself — stored with
 * an ignored broker-connection message, so the reason a reply didn't match a
 * lead (old 8-digit JID, foreign number…) is visible without logging PII.
 */
export function contactNumberShape(value?: string | null): string {
  const digits = normalizePhone(value);
  if (digits.startsWith("55") && digits.length === 13) return digits[4] === "9" ? "br_celular" : "br_outro";
  if (digits.startsWith("55") && digits.length === 12) return /^[6-9]/.test(digits.slice(4)) ? "br_sem_nono_digito" : "br_fixo";
  if (digits.length >= 14) return "id_longo";
  return digits.length ? "outro" : "vazio";
}
