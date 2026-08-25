import { scheduleForBusinessHours } from "@/shared/time/business-hours";

export const BROKER_LEAD_NOTIFICATION_INTERVAL_MS = 10 * 60_000;

export function scheduleBrokerLeadNotification(input: { now: Date; lastScheduledAt?: Date | null }) {
  const cadenceAt = input.lastScheduledAt
    ? new Date(input.lastScheduledAt.getTime() + BROKER_LEAD_NOTIFICATION_INTERVAL_MS)
    : input.now;
  return scheduleForBusinessHours(cadenceAt > input.now ? cadenceAt : input.now);
}
