import { getDutyWindowOnDate } from "./duty-presence-domain";
import { selectEffectiveDutyAssignments } from "./dated-duty-roster";

export const DUTY_SHIFT_REMINDER_LEAD_TIME_MS = 24 * 60 * 60_000;
export const DUTY_SHIFT_REMINDER_CUTOFF_MS = 2 * 60 * 60_000;

export type DutyReminderSchedule = {
  id: string;
  tenantId: string;
  name: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendanceMode: string;
  validFrom: Date;
  validUntil: Date | null;
  status: string;
};

export type DutyReminderAssignment = {
  id: string;
  tenantId: string;
  scheduleId: string;
  brokerId: string;
  brokerName: string;
  phone: string | null;
  /** The database query only returns active memberships; false is kept for pure defensive tests/callers. */
  hasAccount?: boolean;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  validFrom: Date;
  validUntil: Date | null;
  dutyDate: string | null;
  monthlyPlanId: string | null;
  pausedAt: Date | null;
  attendanceMode: string | null;
  branchName: string | null;
  status: string;
};

export type DueDutyShiftReminder = {
  assignment: DutyReminderAssignment;
  schedule: DutyReminderSchedule;
  window: { dutyDate: string; startsAt: Date; endsAt: Date };
};

function dateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getDutyReminderDateKey(now: Date, timezone: string) {
  // At the due window's start the occurrence is exactly 24 hours away, so its local date is `now + 24h`.
  return dateKeyInTimezone(new Date(now.getTime() + DUTY_SHIFT_REMINDER_LEAD_TIME_MS), timezone);
}

export function isDutyShiftReminderDue(startsAt: Date, now: Date) {
  const elapsed = startsAt.getTime() - now.getTime();
  return elapsed <= DUTY_SHIFT_REMINDER_LEAD_TIME_MS && elapsed > DUTY_SHIFT_REMINDER_CUTOFF_MS;
}

export function selectDueDutyShiftReminders(input: {
  schedules: readonly DutyReminderSchedule[];
  assignments: readonly DutyReminderAssignment[];
  publishedScheduleIdsByTenantDate: ReadonlyMap<string, ReadonlySet<string> | null>;
  now: Date;
}): DueDutyShiftReminder[] {
  const assignmentGroups = new Map<string, DutyReminderAssignment[]>();
  for (const assignment of input.assignments) {
    const key = `${assignment.tenantId}|${assignment.scheduleId}|${assignment.brokerId}`;
    assignmentGroups.set(key, [...(assignmentGroups.get(key) ?? []), assignment]);
  }

  const due: DueDutyShiftReminder[] = [];
  for (const schedule of input.schedules) {
    if (schedule.status !== "active") continue;
    const dutyDate = getDutyReminderDateKey(input.now, schedule.timezone);
    const publishedKey = `${schedule.tenantId}:${dutyDate}`;
    const publishedIds = input.publishedScheduleIdsByTenantDate.get(publishedKey) ?? null;
    const groups = [...assignmentGroups.entries()].filter(([key]) => key.startsWith(`${schedule.tenantId}|${schedule.id}|`));
    for (const [, rows] of groups) {
      const effective = selectEffectiveDutyAssignments(rows, dutyDate, publishedIds);
      for (const assignment of effective) {
        if (assignment.status !== "active" || assignment.pausedAt || assignment.hasAccount === false) continue;
        const window = getDutyWindowOnDate({
          dayOfWeek: assignment.dayOfWeek,
          startsAt: assignment.startsAt,
          endsAt: assignment.endsAt,
          timezone: schedule.timezone,
        }, dutyDate);
        if (!window || window.startsAt < assignment.validFrom || (assignment.validUntil && window.startsAt >= assignment.validUntil)) continue;
        if (window.startsAt < schedule.validFrom || (schedule.validUntil && window.startsAt >= schedule.validUntil)) continue;
        if (!isDutyShiftReminderDue(window.startsAt, input.now)) continue;
        due.push({ assignment, schedule, window });
      }
    }
  }
  return due;
}

export function formatDutyShiftReminderVariables(input: DueDutyShiftReminder) {
  const { assignment, schedule, window } = input;
  const date = new Date(`${window.dutyDate}T12:00:00.000Z`);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: schedule.timezone, weekday: "long" }).format(date);
  const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: schedule.timezone, day: "2-digit", month: "2-digit" }).format(date);
  const time = (value: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: schedule.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value);
  const mode = assignment.attendanceMode ?? schedule.attendanceMode;
  const modeLabel = mode === "presencial"
    ? assignment.branchName ? `presencial na unidade ${assignment.branchName}` : "presencial"
    : "online";
  return [assignment.brokerName, weekday, shortDate, schedule.name, time(window.startsAt), time(window.endsAt), modeLabel];
}

export function dutyShiftReminderIdempotencyKey(input: DueDutyShiftReminder) {
  return `duty-reminder-24h:${input.assignment.id}:${input.assignment.brokerId}:${input.window.startsAt.toISOString()}`;
}

/** A missing broker phone is terminal for this occurrence; unavailable WAHA must never route to Meta. */
export function dutyShiftReminderFailureCode(phone: string | null | undefined, companyNumberId: string | null | undefined) {
  if (!phone?.trim()) return "BROKER_PHONE_UNAVAILABLE" as const;
  if (!companyNumberId) return "COMPANY_NUMBER_UNAVAILABLE" as const;
  return null;
}

export function dutyShiftReminderWahaFailure(companyUnavailable: boolean) {
  return companyUnavailable
    ? { retryableOnNextSweep: true, code: "COMPANY_NUMBER_UNAVAILABLE", message: "Número corporativo WAHA indisponível." } as const
    : { retryableOnNextSweep: false, code: "COMPANY_NUMBER_SEND_FAILED", message: "Falha ao enviar o lembrete pelo número corporativo WAHA." } as const;
}
