/**
 * Quotes are off for now (decision of 2026-10-12): /cotacao shows the Cotação
 * assistant "resting". Flip to false to bring the chat and the simulator back.
 */
export const QUOTE_PAUSED = true;

/** Brokers who keep the quote while it is paused for everyone else (Vinicios, 20/10: his broker account). */
const QUOTE_ALLOWED_USER_IDS: ReadonlySet<string> = new Set([
  "ebed87f7-b4f3-41c1-8e92-d234fa5a1ce1", // Vinicios Ragazzi (corretor, viniciosragazzzi@gmail.com)
]);

/** Paused for this broker? Everyone but the allowed list while QUOTE_PAUSED is on. */
export function isQuotePausedFor(userId: string | null | undefined) {
  return QUOTE_PAUSED && !(userId && QUOTE_ALLOWED_USER_IDS.has(userId));
}
