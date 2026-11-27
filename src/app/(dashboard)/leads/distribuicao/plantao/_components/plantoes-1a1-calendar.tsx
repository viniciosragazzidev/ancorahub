"use client";

/**
 * Calendário do mês da aba Plantões 1:1 (27/11/2026, artifact "Distribuição · Plantões"): grade de segunda a sexta com
 * "Agora", os que ainda vão começar (↻ e falta corretor), "N encerrados" e "+" no dia; hoje com o anel azul. No celular,
 * a lista por dia do Celular.dc.html. A rolagem de lado fica num ScrollArea (arrastar para rolar funciona nele).
 */
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { typeColor } from "./duty-type-tag";
import { PlusIcon, pl as s } from "./plantoes-1a1-kit";

type CalendarSchedule = { id: string; name: string; startsAt: string; endsAt: string; typeName?: string | null; typeHue?: number | null };
type ShiftState = "running" | "upcoming" | "done";

const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;
const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
const hhmm = (value: string) => value.slice(0, 5);

function dayHeading(date: string, today: string) {
  const day = Number(date.slice(8, 10));
  const weekday = WEEKDAY_LONG[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const month = MONTHS[Number(date.slice(5, 7)) - 1];
  const label = `${weekday}, ${day === 1 ? "1º" : day} de ${month}`;
  return date === today ? `Hoje, ${label.charAt(0).toLocaleLowerCase("pt-BR")}${label.slice(1)}` : label;
}

export function DutyMonthCalendar1a1<T extends CalendarSchedule>({
  month, today, cells, byDate, stateOf, weekendCount, pastWeekCount, showPastWeeks, onTogglePastWeeks,
  openFullDays, onToggleFullDay, openPastDays, onTogglePastDay, upcomingVisible,
  publishedScheduleIds, draftScheduleIds, gapScheduleIds, repeatingScheduleIds, canCreate, onOpen, onCreateOnDate,
}: {
  month: string;
  today: string;
  cells: Array<string | null>;
  byDate: ReadonlyMap<string, Array<{ schedule: T; done: boolean }>>;
  stateOf: (date: string, item: { schedule: T; done: boolean }) => ShiftState;
  weekendCount: number;
  pastWeekCount: number;
  showPastWeeks: boolean;
  onTogglePastWeeks: () => void;
  openFullDays: ReadonlySet<string>;
  onToggleFullDay: (date: string) => void;
  openPastDays: ReadonlySet<string>;
  onTogglePastDay: (date: string) => void;
  upcomingVisible: number;
  publishedScheduleIds: ReadonlySet<string>;
  draftScheduleIds?: ReadonlySet<string>;
  gapScheduleIds: ReadonlySet<string>;
  repeatingScheduleIds: ReadonlySet<string>;
  canCreate: boolean;
  onOpen: (schedule: T) => void;
  onCreateOnDate: (date: string) => void;
}) {
  const status = (id: string) => {
    const published = publishedScheduleIds.has(id);
    const inDraft = !published && Boolean(draftScheduleIds?.has(id));
    return { published, inDraft, gap: !published && !inDraft && gapScheduleIds.has(id) };
  };
  const dot = (schedule: T) => ({ background: schedule.typeName ? typeColor(schedule.typeHue) : "var(--text-muted)" });
  const title = (schedule: T, label: string) => `${schedule.typeName ? `${schedule.typeName} · ` : ""}${schedule.name} · ${hhmm(schedule.startsAt)} às ${hhmm(schedule.endsAt)}${repeatingScheduleIds.has(schedule.id) ? " · repete toda semana" : ""} · ${label}`;
  const ddmm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  const mobileDates = [...byDate.keys()].filter((date) => date.startsWith(`${month}-`)).sort();
  const upcomingDates = mobileDates.filter((date) => date >= today);
  const pastDates = mobileDates.filter((date) => date < today);
  const mobileDay = (date: string) => (
    <div key={date} className={s.mDay}>
      <p className={cn(s.mDayHead, date === today && s.mDayHeadToday)}>{dayHeading(date, today)}</p>
      {(byDate.get(date) ?? []).map((item) => {
        const state = stateOf(date, item);
        const { published, inDraft, gap } = status(item.schedule.id);
        return (
          <button key={item.schedule.id} type="button" className={cn(s.mShift, state === "running" && s.mShiftNow)} onClick={() => onOpen(item.schedule)}>
            <span className={s.dot} style={dot(item.schedule)} aria-hidden="true" />
            <span className={s.mShiftBody}>
              <span className={s.mShiftName}>{state === "running" ? <span className={cn(s.badge, s.bInfo)}>Agora</span> : null}{item.schedule.name}</span>
              <span className={cn(s.shiftTime)}>
                {repeatingScheduleIds.has(item.schedule.id) ? "↻ " : ""}{hhmm(item.schedule.startsAt)} às {hhmm(item.schedule.endsAt)}
                {state === "done" ? " · encerrado" : published ? " · escala publicada" : inDraft ? " · na escala, rascunho" : ""}
              </span>
            </span>
            {gap && state !== "done" ? <span className={s.dot} aria-label="falta corretor" style={{ background: "var(--warning)" }} /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className={s.calDesktop}>
        {pastWeekCount ? (
          <button type="button" className={s.pastToggle} aria-expanded={showPastWeeks} onClick={onTogglePastWeeks}>
            {showPastWeeks ? "Esconder as semanas que já passaram" : `Mostrar ${pastWeekCount} ${pastWeekCount === 1 ? "semana que já passou" : "semanas que já passaram"}`}
          </button>
        ) : null}
        <ScrollArea orientation="horizontal" className={s.calWrap}>
          <div className={s.calMin}>
            <div className={s.cal} role="grid" aria-label="Calendário de plantões">
              {WEEKDAYS.map((day) => <div key={day} className={s.calh} role="columnheader">{day}</div>)}
              {cells.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className={cn(s.day, s.dayPast)} aria-hidden="true" />;
                const items = (byDate.get(date) ?? []).map((item) => ({ ...item, state: stateOf(date, item) }));
                const past = date < today;
                const isToday = date === today;
                const running = items.filter((item) => item.state === "running");
                const upcoming = items.filter((item) => item.state === "upcoming");
                const closed = items.filter((item) => item.state === "done");
                const showAll = openFullDays.has(date) || upcoming.length <= upcomingVisible + 1;
                const visibleUpcoming = showAll ? upcoming : upcoming.slice(0, upcomingVisible);
                const closedOpen = openPastDays.has(date);
                return (
                  <div key={date} role="gridcell" aria-label={`${ddmm(date)}: ${items.length} plantões`} className={cn(s.day, past && s.dayPast, isToday && s.dayToday)}>
                    <span className={s.dayn}>
                      <span className={cn(s.num, past && s.daynPast, isToday && s.daynToday)}>
                        {Number(date.slice(8, 10))}
                        {isToday ? <span className={s.todayWord}>hoje</span> : null}
                      </span>
                      {canCreate && !past ? (
                        <button type="button" className={s.dayadd} aria-label={`Novo plantão em ${ddmm(date)}`} onClick={() => onCreateOnDate(date)}><PlusIcon /></button>
                      ) : null}
                    </span>
                    {running.map(({ schedule }) => (
                      <button key={schedule.id} type="button" className={cn(s.shift, s.shiftNow)} title={title(schedule, "acontecendo agora")} data-shift-state="running" onClick={() => onOpen(schedule)}>
                        <span className={s.ptype} style={dot(schedule)} />
                        <span className={s.shiftBody}>
                          <span className={s.shiftLine}>
                            <span className={cn(s.badge, s.bInfo, s.badgeSlim, s.flexNone)}>Agora</span>
                            <span className={s.shiftName}>{schedule.name}</span>
                          </span>
                          <span className={s.shiftTime}>{hhmm(schedule.startsAt)} às {hhmm(schedule.endsAt)}</span>
                        </span>
                      </button>
                    ))}
                    {visibleUpcoming.map(({ schedule }) => {
                      const { gap } = status(schedule.id);
                      return (
                        <button key={schedule.id} type="button" className={s.up} title={title(schedule, gap ? "ainda não começou · falta corretor" : "ainda não começou")} data-shift-state="upcoming" onClick={() => onOpen(schedule)}>
                          <span className={cn(s.dot, s.dotSm)} style={dot(schedule)} aria-hidden="true" />
                          <span className={s.upStart}>{hhmm(schedule.startsAt)}</span>
                          {repeatingScheduleIds.has(schedule.id) ? <span aria-label="repete toda semana" className={s.flexNone}>↻</span> : null}
                          <span className={s.upName}>{schedule.name}</span>
                          {gap ? <span className={cn(s.dot, s.gapDot)} aria-label="falta corretor" /> : null}
                        </button>
                      );
                    })}
                    {!showAll ? (
                      <button type="button" className={s.more} aria-expanded={false} onClick={() => onToggleFullDay(date)}>+{upcoming.length - upcomingVisible} por começar</button>
                    ) : openFullDays.has(date) ? (
                      <button type="button" className={s.more} aria-expanded onClick={() => onToggleFullDay(date)}>Mostrar menos</button>
                    ) : null}
                    {closed.length ? (
                      <button type="button" className={cn(s.closed, s.num)} aria-expanded={closedOpen} onClick={() => onTogglePastDay(date)}>
                        {closedOpen ? "Recolher encerrados" : `${closed.length} ${closed.length === 1 ? "encerrado" : "encerrados"}`}
                      </button>
                    ) : null}
                    {closedOpen ? closed.map(({ schedule }) => (
                      <button key={schedule.id} type="button" className={s.closedItem} title={title(schedule, "encerrado")} data-shift-state="done" onClick={() => onOpen(schedule)}>
                        {hhmm(schedule.startsAt)} {schedule.name}
                      </button>
                    )) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
      <div className={s.mDays} aria-label="Plantões do mês">
        {upcomingDates.length ? upcomingDates.map(mobileDay) : <p className={s.note}>Nenhum plantão por acontecer neste mês.</p>}
        {pastDates.length ? (
          <details className={s.mPast}>
            <summary>{pastDates.length} {pastDates.length === 1 ? "dia que já passou" : "dias que já passaram"}</summary>
            {pastDates.map(mobileDay)}
          </details>
        ) : null}
      </div>
      {weekendCount ? (
        <p className={s.note}>{weekendCount} {weekendCount === 1 ? "plantão cai" : "plantões caem"} no sábado ou domingo e não {weekendCount === 1 ? "aparece" : "aparecem"} no quadro.</p>
      ) : null}
    </>
  );
}
