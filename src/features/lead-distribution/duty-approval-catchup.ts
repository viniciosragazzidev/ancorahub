/**
 * Presencial plantão (30/10): the broker who sent the photo on time does not pay for the wait until
 * someone approves it. Pure, no I/O.
 *
 * Had the broker been approved at the photo, they would have entered the rotation at the end and
 * moved up one place per lead handed out. So, at the approval, with `offersSincePhoto` leads given
 * since the photo and `queueLength` brokers ahead:
 * - fewer leads than the queue: they take the place they would be in now;
 * - otherwise they lost `floor(offers / (queue + 1))` turns: they get the next lead and the rest
 *   comes back as credit, one turn every other lead (no burst).
 */

export const TURN_CREDIT_PREFIX = "duty-turn-credit";

export function turnCreditSettingKey(scheduleId: string, dutyDate: string) {
  return `${TURN_CREDIT_PREFIX}:${scheduleId}:${dutyDate}`;
}

export function parseTurnCredit(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] > 0));
  } catch {
    return {};
  }
}

export function placeAfterApprovalDelay(input: { stored: readonly string[]; brokerId: string; offersSincePhoto: number }) {
  const queue = input.stored.filter((id) => id !== input.brokerId);
  const offers = Math.max(0, Math.floor(input.offersSincePhoto));
  const missedTurns = Math.floor(offers / (queue.length + 1));
  const index = missedTurns > 0 ? 0 : Math.max(0, queue.length - offers);
  return {
    order: [...queue.slice(0, index), input.brokerId, ...queue.slice(index)],
    credit: Math.max(0, missedTurns - 1),
    missedTurns,
  };
}
