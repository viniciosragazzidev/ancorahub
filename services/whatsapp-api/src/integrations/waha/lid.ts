/**
 * WhatsApp addresses some contacts by a privacy identifier (`<digits>@lid`)
 * instead of `<phone>@c.us`. The CRM matches inbound messages to leads by
 * phone, so a bare LID looked like an unknown 15-digit "phone" and every
 * message from that client was dropped. Before forwarding a message event,
 * the relay asks WAHA for the phone behind each LID and attaches it as
 * `payload._ancora.{from,to}Pn`, leaving the original fields untouched.
 */

export type LidPhoneResolver = (sessionName: string, lid: string) => Promise<string | null>;

const MESSAGE_EVENTS = new Set(["message", "message.any", "message.inbound"]);
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { phone: string | null; expiresAt: number }>();

export function isLid(value: unknown): value is string {
  return typeof value === "string" && value.endsWith("@lid");
}

async function cachedResolve(resolve: LidPhoneResolver, sessionName: string, lid: string, now: number) {
  const key = `${sessionName}:${lid}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.phone;
  const phone = await resolve(sessionName, lid).catch(() => null);
  // Misses are cached too (shorter), so a burst from one unresolved contact doesn't hammer WAHA.
  cache.set(key, { phone, expiresAt: now + (phone ? CACHE_TTL_MS : CACHE_TTL_MS / 10) });
  return phone;
}

/** Mutates `body` in place; returns which sides were resolved (for logs, never the numbers). */
export async function attachLidPhoneNumbers(body: unknown, resolve: LidPhoneResolver, now = Date.now()) {
  const result = { from: false, to: false };
  if (!body || typeof body !== "object") return result;
  const envelope = body as { event?: unknown; session?: unknown; payload?: Record<string, unknown> };
  if (!MESSAGE_EVENTS.has(String(envelope.event)) || typeof envelope.session !== "string") return result;
  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") return result;

  const attached: Record<string, string> = {};
  for (const side of ["from", "to"] as const) {
    const value = payload[side];
    if (!isLid(value)) continue;
    const phone = await cachedResolve(resolve, envelope.session, value, now);
    if (phone) {
      attached[`${side}Pn`] = phone;
      result[side] = true;
    }
  }
  if (Object.keys(attached).length) {
    const existing = payload._ancora && typeof payload._ancora === "object" ? payload._ancora as Record<string, unknown> : {};
    payload._ancora = { ...existing, ...attached };
  }
  return result;
}

export function clearLidCacheForTests() {
  cache.clear();
}
