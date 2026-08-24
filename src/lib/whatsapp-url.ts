/**
 * Normalizes a destination only for WhatsApp delivery. The value saved on the
 * lead stays untouched, so historical imports and matching keep their source value.
 */
export function normalizeWhatsAppDestination(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+") && !trimmed.startsWith("+55")) {
    return digits;
  }

  // Add the Brazilian country code when the number is local.
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  // Brazilian mobile numbers use nine subscriber digits. Some legacy lead
  // sources still provide 55 + DDD + eight mobile digits; WAHA does not apply
  // WhatsApp Web's permissive lookup, so add the missing prefix only when the
  // eight-digit subscriber number has a mobile prefix (6–9). Landlines (2–5)
  // and international numbers are preserved.
  if (
    digits.length === 12 &&
    digits.startsWith("55") &&
    Number(digits.slice(2, 4)) >= 11 &&
    Number(digits.slice(2, 4)) <= 99 &&
    /^[6-9]$/.test(digits[4] ?? "")
  ) {
    digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }

  return digits;
}

/**
 * Helper to build valid, pop-up-safe WhatsApp URLs.
 */
export function buildWhatsAppUrl(phone?: string | null, messageText?: string): string | null {
  const digits = normalizeWhatsAppDestination(phone);
  if (!digits) return null;

  const encodedMsg = messageText ? encodeURIComponent(messageText) : "";
  return `https://wa.me/${digits}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}
