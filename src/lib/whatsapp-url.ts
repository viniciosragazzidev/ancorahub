/**
 * Helper to build valid, pop-up-safe WhatsApp URLs.
 * Ensures proper country code (55 for Brazil) without duplicating 5555 prefixes.
 */
export function buildWhatsAppUrl(phone?: string | null, messageText?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Add 55 country code if missing (10 or 11 digit Brazilian number)
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }

  const encodedMsg = messageText ? encodeURIComponent(messageText) : "";
  return `https://wa.me/${digits}${encodedMsg ? `?text=${encodedMsg}` : ""}`;
}
