"use client";

import { useMemo } from "react";

import { Plus } from "@/components/huge-icons";
import { cn } from "@/lib/utils";
import { typeStripe } from "./duty-type-tag";

type CalendarSchedule = { id: string; name: string; startsAt: string; endsAt: string; status: string; validFrom: Date; validUntil: Date | null; typeName?: string | null; typeHue?: number | null };
type Progress = { dates: Array<{ date: string; done: boolean }> };

// Plantões run on weekdays: the board shows Monday to Friday only.
const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/**
 * The month as a calendar: each day lists the plantões that happen on it.
 * Past days are muted and compact; today is highlighted.
 */
export function DutyMonthCalendar<T extends CalendarSchedule>({
  month,
  schedules,
  progressById,
  publishedScheduleIds,
  draftScheduleIds,
  gapScheduleIds,
  repeatingScheduleIds,
  canCreate,
  onOpen,
  onCreateOnDate,
}: {
  month: string;
  schedules: T[];
  progressById: ReadonlyMap<string, Progress>;
  publishedScheduleIds: ReadonlySet<string>;
  /** In an escala that is still a draft (not covering yet, but not missing either). */
  draftScheduleIds?: ReadonlySet<string>;
  /** Weekly plantões below their minimum (upcoming dates get a warning). */
  gapScheduleIds: ReadonlySet<string>;
  /** Weekly rules (more than one date): shown with ↻. */
  repeatingScheduleIds: ReadonlySet<string>;
  canCreate: boolean;
  onOpen: (schedule: T) => void;
  onCreateOnDate: (date: string) => void;
}) {
  const today = todayKey();
  const { cells, byDate, weekendCount } = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7; // Monday first
    const days: Array<string | null> = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
    ];
    while (days.length % 7) days.push(null);
    const map = new Map<string, Array<{ schedule: T; done: boolean }>>();
    for (const schedule of schedules) {
      for (const item of progressById.get(schedule.id)?.dates ?? []) {
        map.set(item.date, [...(map.get(item.date) ?? []), { schedule, done: item.done }]);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.schedule.startsAt.localeCompare(b.schedule.startsAt) || a.schedule.name.localeCompare(b.schedule.name, "pt-BR"));
    // Drop whole weeks that are already over and had no plantão: the month
    // starts at the first week that still matters (never removes single days).
    const weeks: Array<Array<string | null>> = [];
    for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
    const visibleWeeks = weeks.filter((week) => week.slice(0, 5).some((date) => date && (date >= today || map.has(date))));
    // Saturday and Sunday are left out of the board (count shown below if any).
    const weekendCount = weeks.flatMap((week) => week.slice(5)).reduce((sum, date) => sum + (date ? map.get(date)?.length ?? 0 : 0), 0);
    return { cells: visibleWeeks.flatMap((week) => week.slice(0, 5)), byDate: map, weekendCount };
  }, [month, progressById, schedules, today]);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] grid-cols-5 overflow-hidden rounded-[var(--radius-card)] border border-border bg-border gap-px" role="grid" aria-label="Calendário de plantões">
        {WEEKDAY_HEADERS.map((day) => (
          <div key={day} role="columnheader" className="bg-muted/40 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">{day}</div>
        ))}
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} className="bg-[color-mix(in_oklab,var(--card)_65%,var(--muted))]" aria-hidden="true" />;
          const items = byDate.get(date) ?? [];
          const past = date < today;
          const isToday = date === today;
          return (
            <div
              key={date}
              role="gridcell"
              aria-label={`${date.slice(8, 10)}/${date.slice(5, 7)}: ${items.length} plantões`}
              className={cn("group/day flex min-h-24 flex-col gap-1 p-1.5", past ? "bg-[color-mix(in_oklab,var(--card)_65%,var(--muted))]" : "bg-card", isToday && "ring-2 ring-inset ring-primary/60")}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px] font-semibold tabular-nums", past ? "text-muted-foreground/70" : "text-foreground", isToday && "text-primary")}>
                  {Number(date.slice(8, 10))}
                  {isToday ? <span className="ml-1 font-medium">hoje</span> : null}
                </span>
                {canCreate && !past ? (
                  <button
                    type="button"
                    onClick={() => onCreateOnDate(date)}
                    aria-label={`Novo plantão em ${date.slice(8, 10)}/${date.slice(5, 7)}`}
                    className="grid size-5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/day:opacity-100"
                  >
                    <Plus className="size-3" />
                  </button>
                ) : null}
              </div>
              {items.map(({ schedule, done }) => {
                const published = publishedScheduleIds.has(schedule.id);
                const inDraft = !published && Boolean(draftScheduleIds?.has(schedule.id));
                const gap = !done && !published && !inDraft && gapScheduleIds.has(schedule.id);
                return (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => onOpen(schedule)}
                    title={`${schedule.typeName ? `${schedule.typeName} · ` : ""}${schedule.name} · ${schedule.startsAt.slice(0, 5)}–${schedule.endsAt.slice(0, 5)}${repeatingScheduleIds.has(schedule.id) ? " · repete toda semana" : ""}${done ? " · encerrado" : ""}`}
                    style={schedule.typeName ? typeStripe(schedule.typeHue) : undefined}
                    className={cn(
                      "w-full min-w-0 rounded-md border px-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      done
                        ? "border-dashed border-border bg-transparent py-0.5 text-muted-foreground hover:bg-muted/60"
                        : cn("bg-card py-1 hover:border-foreground/30", gap ? "border-warning/50" : "border-border", published && "border-success/50"),
                    )}
                  >
                    <span className={cn("flex items-center gap-1 truncate font-medium", done ? "text-[10px]" : "text-[11px] text-foreground")}>
                      {repeatingScheduleIds.has(schedule.id) ? <span aria-label="repete toda semana" className="shrink-0 text-muted-foreground">↻</span> : null}
                      <span className="truncate">{schedule.name}</span>
                    </span>
                    {done ? null : (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {schedule.startsAt.slice(0, 5)}–{schedule.endsAt.slice(0, 5)}{published ? " · escala publicada" : inDraft ? " · na escala (rascunho)" : gap ? " · falta corretor" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {weekendCount ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {weekendCount} {weekendCount === 1 ? "plantão cai" : "plantões caem"} no sábado ou domingo e não {weekendCount === 1 ? "aparece" : "aparecem"} no quadro.
        </p>
      ) : null}
    </div>
  );
}
