import type { NoticeClass } from "./catalog";

/**
 * Delivery guard for team notices (DEC-125): protects the company WAHA number
 * from bans and team members from spam. Pure, no I/O. Values live here, not
 * on the director's screen.
 */
export const DELIVERY_LIMITS = {
  timeZone: "America/Sao_Paulo",
  businessDays: [1, 2, 3, 4, 5] as readonly number[],
  businessStartMinutes: 8 * 60,
  businessEndMinutes: 18 * 60,
  companyNumber: {
    gapMs: 8_000,
    jitterMs: 7_000,
    criticalGapMs: 3_000,
    criticalJitterMs: 2_000,
    perHour: 40,
    perDay: 250,
    warmupDays: 7,
    warmupPerHour: 15,
    breakerFailures: 3,
    breakerPauseMs: 30 * 60_000,
  },
  recipient: {
    gapMs: 60_000,
    perHour: 4,
    perDay: 15,
    remindersPerDay: 2,
    duplicateWindowMs: 6 * 3_600_000,
  },
  reminderMaxAgeMs: 12 * 3_600_000,
} as const;

export type GuardInput = {
  noticeClass: NoticeClass;
  now: Date;
  createdAt: Date;
  /** The channel this attempt uses. Limits of the company number only apply to it. */
  channel: "company_number" | "meta";
  /** Uniform random number in [0, 1) for the spacing jitter. */
  random: number;
  recipient: {
    lastSentAt: Date | null;
    /** Non-critical notices sent to this person in the last hour / since 00:00 local. */
    sentLastHour: number;
    sentToday: number;
    remindersToday: number;
    /** Same notice about the same subject sent within the duplicate window. */
    duplicateRecently: boolean;
  };
  number: { lastSentAt: Date | null; sentLastHour: number; sentToday: number; connectedAt: Date | null } | null;
};

export type GuardResult =
  | { kind: "now" }
  | { kind: "hold"; until: Date; reason: HoldReason }
  | { kind: "drop"; reason: DropReason };

export type HoldReason = "outside_business_hours" | "recipient_spacing" | "recipient_hourly_limit" | "recipient_daily_limit" | "number_spacing" | "number_hourly_limit" | "number_daily_limit";
export type DropReason = "stale_reminder" | "duplicate" | "reminder_daily_limit";

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: DELIVERY_LIMITS.timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")), dateKey: `${get("year")}-${get("month")}-${get("day")}` };
}

export function isBusinessHours(date: Date) {
  const { weekday, minutes } = localParts(date);
  return DELIVERY_LIMITS.businessDays.includes(weekday) && minutes >= DELIVERY_LIMITS.businessStartMinutes && minutes < DELIVERY_LIMITS.businessEndMinutes;
}

/** Next instant business hours open (or `date` itself when they are open). */
export function nextBusinessOpening(date: Date) {
  if (isBusinessHours(date)) return date;
  // Walk forward minute-accurately from the next local 08:00 candidates.
  for (let offsetDays = 0; offsetDays <= 7; offsetDays += 1) {
    const probe = new Date(date.getTime() + offsetDays * 86_400_000);
    const { weekday, minutes } = localParts(probe);
    if (!DELIVERY_LIMITS.businessDays.includes(weekday)) continue;
    const opening = new Date(probe.getTime() + (DELIVERY_LIMITS.businessStartMinutes - minutes) * 60_000);
    const aligned = new Date(Math.floor(opening.getTime() / 60_000) * 60_000);
    if (aligned.getTime() > date.getTime()) return aligned;
  }
  return new Date(date.getTime() + 86_400_000);
}

function numberSpacing(input: GuardInput, critical: boolean): GuardResult | null {
  if (input.channel !== "company_number" || !input.number?.lastSentAt) return null;
  const limits = DELIVERY_LIMITS.companyNumber;
  const gap = critical ? limits.criticalGapMs + input.random * limits.criticalJitterMs : limits.gapMs + input.random * limits.jitterMs;
  const readyAt = input.number.lastSentAt.getTime() + gap;
  return readyAt > input.now.getTime() ? { kind: "hold", until: new Date(readyAt), reason: "number_spacing" } : null;
}

export function evaluateDeliveryGuard(input: GuardInput): GuardResult {
  const { now } = input;
  // New lead and lead information: no limits and no business hours; only the
  // company number's short spacing, so two messages never leave glued together.
  if (input.noticeClass === "critical") return numberSpacing(input, true) ?? { kind: "now" };

  const reminder = input.noticeClass === "reminder";
  if (reminder && now.getTime() - input.createdAt.getTime() > DELIVERY_LIMITS.reminderMaxAgeMs) return { kind: "drop", reason: "stale_reminder" };
  if (input.recipient.duplicateRecently) return { kind: "drop", reason: "duplicate" };
  if (reminder && input.recipient.remindersToday >= DELIVERY_LIMITS.recipient.remindersPerDay) return { kind: "drop", reason: "reminder_daily_limit" };

  if (!isBusinessHours(now)) return { kind: "hold", until: nextBusinessOpening(now), reason: "outside_business_hours" };

  const recipient = DELIVERY_LIMITS.recipient;
  if (input.recipient.sentToday >= recipient.perDay) {
    return { kind: "hold", until: nextBusinessOpening(new Date(now.getTime() + 24 * 3_600_000 - (localParts(now).minutes * 60_000))), reason: "recipient_daily_limit" };
  }
  if (input.recipient.sentLastHour >= recipient.perHour) return { kind: "hold", until: new Date(now.getTime() + 15 * 60_000), reason: "recipient_hourly_limit" };
  if (input.recipient.lastSentAt && input.recipient.lastSentAt.getTime() + recipient.gapMs > now.getTime()) {
    return { kind: "hold", until: new Date(input.recipient.lastSentAt.getTime() + recipient.gapMs), reason: "recipient_spacing" };
  }

  if (input.channel === "company_number" && input.number) {
    const limits = DELIVERY_LIMITS.companyNumber;
    const warmingUp = input.number.connectedAt !== null && now.getTime() - input.number.connectedAt.getTime() < limits.warmupDays * 86_400_000;
    const perHour = warmingUp ? limits.warmupPerHour : limits.perHour;
    if (input.number.sentToday >= limits.perDay) return { kind: "hold", until: nextBusinessOpening(new Date(now.getTime() + 24 * 3_600_000 - (localParts(now).minutes * 60_000))), reason: "number_daily_limit" };
    if (input.number.sentLastHour >= perHour) return { kind: "hold", until: new Date(now.getTime() + 10 * 60_000), reason: "number_hourly_limit" };
  }
  return numberSpacing(input, false) ?? { kind: "now" };
}

/** Local calendar day (for "today" counts) in the guard's time zone. */
export function localDateKey(date: Date) {
  return localParts(date).dateKey;
}
