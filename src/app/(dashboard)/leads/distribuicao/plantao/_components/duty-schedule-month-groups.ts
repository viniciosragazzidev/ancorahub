export type DutyScheduleMonthGroup<T> = {
  key: string;
  label: string;
  schedules: T[];
};

/** validFrom is persisted as a UTC date value from the date input. */
export function getDutyScheduleMonthKey(validFrom: Date) {
  return validFrom.toISOString().slice(0, 7);
}

export function getOperationalMonthKey(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 15, 12));
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

export function groupDutySchedulesByMonth<T extends { validFrom: Date }>(
  schedules: T[],
  currentMonthKey: string,
): DutyScheduleMonthGroup<T>[] {
  const grouped = new Map<string, T[]>();
  for (const schedule of schedules) {
    const key = getDutyScheduleMonthKey(schedule.validFrom);
    const monthSchedules = grouped.get(key) ?? [];
    monthSchedules.push(schedule);
    grouped.set(key, monthSchedules);
  }

  return [...grouped.entries()]
    .sort(([first], [second]) => {
      if (first === currentMonthKey) return -1;
      if (second === currentMonthKey) return 1;
      const firstIsFuture = first > currentMonthKey;
      const secondIsFuture = second > currentMonthKey;
      if (firstIsFuture !== secondIsFuture) return firstIsFuture ? -1 : 1;
      return firstIsFuture ? first.localeCompare(second) : second.localeCompare(first);
    })
    .map(([key, monthSchedules]) => ({
      key,
      label: monthLabel(key),
      schedules: monthSchedules,
    }));
}

export function getDefaultDutyScheduleMonthKey(
  groups: DutyScheduleMonthGroup<unknown>[],
  currentMonthKey: string,
) {
  return groups.find((group) => group.key === currentMonthKey)?.key
    ?? groups.find((group) => group.key > currentMonthKey)?.key
    ?? groups[0]?.key
    ?? currentMonthKey;
}
