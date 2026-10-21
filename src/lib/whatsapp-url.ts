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
 * Where a WhatsApp link goes (Vinicios, 2026-10-21): the computer opens
 * WhatsApp Web straight in the chat (no "abrir no WhatsApp" page from wa.me),
 * the phone opens the app itself.
 */
export type WhatsAppDevice = "desktop" | "mobile";

/** Tab name for WhatsApp Web: repeated clicks reuse the same tab when the browser allows it. */
export const WHATSAPP_WEB_TARGET = "whatsapp_web";

function sendQuery(phone: string | null, text?: string | null) {
  const parts: string[] = [];
  if (phone) parts.push(`phone=${phone}`);
  if (text) parts.push(`text=${encodeURIComponent(text)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** https://web.whatsapp.com/send?phone=55...&text=... (no phone: WhatsApp asks for the contact). */
export function buildWhatsAppWebUrl(phone?: string | null, text?: string | null): string {
  return `https://web.whatsapp.com/send${sendQuery(normalizeWhatsAppDestination(phone), text)}`;
}

/** whatsapp://send?phone=55...&text=... opens the installed app directly. */
export function buildWhatsAppAppUrl(phone?: string | null, text?: string | null): string {
  return `whatsapp://send${sendQuery(normalizeWhatsAppDestination(phone), text)}`;
}

/**
 * The link to a client's WhatsApp. Without a device (server render) it is the
 * WhatsApp Web link; on a phone the click handler swaps it for the app link.
 */
export function buildWhatsAppUrl(phone?: string | null, messageText?: string, device: WhatsAppDevice = "desktop"): string | null {
  if (!normalizeWhatsAppDestination(phone)) return null;
  return device === "mobile" ? buildWhatsAppAppUrl(phone, messageText) : buildWhatsAppWebUrl(phone, messageText);
}

/** Old builders wrote wa.me/55${digits} over numbers that already had 55: undo the double prefix. */
function fixDoubleCountryCode(phone: string | null) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("5555") && (digits.length === 14 || digits.length === 15) ? digits.slice(2) : digits;
}

/**
 * Reads any WhatsApp "send" link (wa.me, api.whatsapp.com, web.whatsapp.com/send,
 * whatsapp://send). Other links (including the bare web.whatsapp.com home) give null.
 */
export function parseWhatsAppUrl(href: string | null | undefined): { phone: string | null; text: string | null } | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");
  let phone: string | null;
  if (url.protocol === "whatsapp:") {
    // whatsapp://send parses with "send" as the host.
    if (host !== "send" && path !== "send" && path !== "//send") return null;
    phone = url.searchParams.get("phone");
  } else if (url.protocol === "https:" || url.protocol === "http:") {
    if (host === "wa.me" || host === "www.wa.me") phone = path.replace(/^\//, "") || null;
    else if ((host === "api.whatsapp.com" || host === "web.whatsapp.com") && path === "/send") phone = url.searchParams.get("phone");
    else return null;
  } else {
    return null;
  }
  return { phone: normalizeWhatsAppDestination(fixDoubleCountryCode(phone)), text: url.searchParams.get("text") };
}

/** Any WhatsApp send link rewritten for the device (null when it is not one). */
export function toDeviceWhatsAppUrl(href: string | null | undefined, device: WhatsAppDevice): string | null {
  const parsed = parseWhatsAppUrl(href);
  if (!parsed) return null;
  return device === "mobile" ? buildWhatsAppAppUrl(parsed.phone, parsed.text) : buildWhatsAppWebUrl(parsed.phone, parsed.text);
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|webOS|BlackBerry/i;

/** Phone or tablet: a mobile user agent or a touch screen as the main pointer (iPadOS reports a Mac UA). */
export function isMobileWhatsAppDevice(input: { userAgent?: string | null; coarsePointer?: boolean }): boolean {
  return MOBILE_UA.test(input.userAgent ?? "") || Boolean(input.coarsePointer);
}
