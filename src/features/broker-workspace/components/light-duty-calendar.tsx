"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, MapPin } from "lucide-react";

import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/arc/button/button";
import { Calendar } from "@/components/arc/calendar/calendar";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import "@/components/arc/venancor-scope.css";
import { cn } from "@/lib/utils";
import type {
  BrokerDutyCalendarOccurrence,
  BrokerDutyCalendarResult,
} from "../duty-calendar";
import styles from "./light-duty-calendar-motion.module.css";

type LightDutyCalendarProps = { calendar: BrokerDutyCalendarResult };

const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: "var(--radius-surface)",
  boxShadow: "var(--shadow-resting)",
};

// These helpers keep the original dutyDate handling untouched: the YYYY-MM-DD
// key is rendered as noon UTC and formatted with timeZone UTC.
function localDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKeyFromLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function utcDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function monthFromKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, 1, 12);
}

function finalVisibleDate(endExclusiveKey: string) {
  const [year, month] = endExclusiveKey.split("-").map(Number);
  return new Date(year, month - 1, 0, 12);
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(utcDateFromKey(dateKey));
}

function capitalizeLabel(value: string) {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function addDaysToKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function sourceLabel(source: BrokerDutyCalendarOccurrence["source"]) {
  return source === "published" ? "Escala publicada" : "Escala semanal";
}

function getOccurrenceTime(occurrence: BrokerDutyCalendarOccurrence) {
  return `${occurrence.startsAt.slice(0, 5)}–${occurrence.endsAt.slice(0, 5)}${occurrence.endsNextDay ? " (+1 dia)" : ""}`;
}

export function LightDutyCalendar({ calendar }: LightDutyCalendarProps) {
  const firstOccurrence = calendar.occurrences[0];
  const [selectedDateKey, setSelectedDateKey] = useState(firstOccurrence?.dutyDate ?? calendar.todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromKey(firstOccurrence?.dutyDate ?? calendar.todayKey));
  const [sheetDateKey, setSheetDateKey] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<BrokerDutyCalendarOccurrence | null>(null);
  const calendarHostRef = useRef<HTMLDivElement>(null);

  const occurrencesByDate = useMemo(() => {
    const result = new Map<string, BrokerDutyCalendarOccurrence[]>();
    for (const occurrence of calendar.occurrences) {
      const day = result.get(occurrence.dutyDate) ?? [];
      day.push(occurrence);
      result.set(occurrence.dutyDate, day);
    }
    return result;
  }, [calendar.occurrences]);

  // Marks the Arc calendar day buttons (data-date="YYYY-MM-DD") that carry a
  // duty with data-duty, so the stylesheet draws the accent dot. Runs after
  // every render, including month navigation, which rebuilds the panes.
  useEffect(() => {
    const host = calendarHostRef.current;
    if (!host) return;
    for (const button of Array.from(host.querySelectorAll<HTMLElement>("[data-date]"))) {
      const key = button.getAttribute("data-date") ?? "";
      if (occurrencesByDate.has(key)) button.setAttribute("data-duty", "");
      else button.removeAttribute("data-duty");
    }
  });

  // Plantão de hoje (preferindo o que está em andamento) ou o próximo.
  const highlight = useMemo(() => {
    const todayOnes = calendar.occurrences.filter((occurrence) => occurrence.dutyDate === calendar.todayKey);
    return todayOnes.find((occurrence) => occurrence.inProgress) ?? todayOnes[0] ?? firstOccurrence ?? null;
  }, [calendar, firstOccurrence]);

  const nextSevenDays = useMemo(() => {
    const lastKey = addDaysToKey(calendar.todayKey, 6);
    // The highlight card already shows this occurrence, so keep it out of
    // the seven-day list to avoid repeating the same shift and its status.
    return calendar.occurrences.filter((occurrence) =>
      occurrence.id !== highlight.id &&
      occurrence.dutyDate >= calendar.todayKey &&
      occurrence.dutyDate <= lastKey,
    );
  }, [calendar, highlight]);

  function openDay(dateKey: string) {
    setSelectedDateKey(dateKey);
    setSelectedOccurrence(null);
    setSheetDateKey(dateKey);
  }

  function openOccurrence(occurrence: BrokerDutyCalendarOccurrence) {
    setSelectedDateKey(occurrence.dutyDate);
    setSheetDateKey(occurrence.dutyDate);
    setSelectedOccurrence(occurrence);
  }

  function jumpToToday() {
    setVisibleMonth(monthFromKey(calendar.todayKey));
    setSelectedDateKey(calendar.todayKey);
  }

  const sheetOccurrences = sheetDateKey ? occurrencesByDate.get(sheetDateKey) ?? [] : [];
  const sheetDateLabel = sheetDateKey
    ? capitalizeLabel(formatDate(sheetDateKey, { weekday: "long", day: "numeric", month: "long" }))
    : "";

  return (
    <section aria-labelledby="duty-calendar-page-title" className="mx-auto w-full max-w-3xl px-4 pb-[max(120px,var(--mobile-safe-bottom,0px))] pt-6 sm:px-6">
      <header className="space-y-1">
        <h1 id="duty-calendar-page-title" className="text-[30px] font-bold leading-tight" style={{ letterSpacing: "var(--tracking-display)", color: "var(--foreground)" }}>
          Plantões
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {calendar.occurrences.length === 1 ? "1 plantão no período" : `${calendar.occurrences.length} plantões no período`}
        </p>
      </header>

      <div className="mt-6 space-y-6">
        {highlight ? (
          <button
            type="button"
            onClick={() => openOccurrence(highlight)}
            aria-label={`Ver plantão ${highlight.scheduleName}, das ${getOccurrenceTime(highlight)}`}
            className="w-full cursor-pointer p-4 text-left transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-5"
            style={CARD_STYLE}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold" style={{ color: "var(--foreground)" }}>{highlight.scheduleName}</h2>
                  <Badge tone={highlight.dutyDate === calendar.todayKey ? "info" : "neutral"} size="sm">
                    {highlight.dutyDate === calendar.todayKey ? "Hoje" : "Próximo plantão"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                  {formatDate(highlight.dutyDate, { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              {highlight.inProgress && <Badge tone="success" size="sm" className="shrink-0">Em andamento</Badge>}
              {highlight.paused && !highlight.inProgress && <Badge tone="warning" size="sm" className="shrink-0">Pausado</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock3 className="size-4" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                {getOccurrenceTime(highlight)}
              </span>
              {highlight.branchName && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                  <span className="truncate">{highlight.branchName}</span>
                </span>
              )}
            </div>
          </button>
        ) : (
          <div className="px-4 py-10" style={CARD_STYLE}>
            <EmptyState
              label="Nenhum plantão próximo"
              icon={<CalendarDays width={24} height={24} strokeWidth={1.5} />}
              title="Nenhum plantão próximo"
              description="Quando você estiver em uma escala ativa, os próximos horários vão aparecer aqui."
            />
          </div>
        )}

        <section aria-label="Calendário dos seus plantões" className="p-4 sm:p-5" style={CARD_STYLE}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Calendário</h2>
            <Button type="button" variant="secondary" size="sm" onClick={jumpToToday}>
              Hoje
            </Button>
          </div>
          <div ref={calendarHostRef} className={cn(styles.calendarHost, "flex justify-center")}>
            <Calendar
              locale="pt-BR"
              value={localDateFromKey(selectedDateKey)}
              onChange={(date) => openDay(dateKeyFromLocalDate(date))}
              month={visibleMonth}
              onMonthChange={setVisibleMonth}
              minDate={localDateFromKey(calendar.todayKey)}
              maxDate={finalVisibleDate(calendar.endExclusiveKey)}
            />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="inline-block size-1.5 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
            Dia com plantão escalado. Toque em uma data para ver os detalhes.
          </p>
        </section>

        {nextSevenDays.length > 0 && (
          <section aria-labelledby="next-seven-days-title" style={CARD_STYLE}>
            <h2 id="next-seven-days-title" className="px-4 pt-4 text-base font-semibold sm:px-5" style={{ color: "var(--foreground)" }}>
              Próximos 7 dias
            </h2>
            <ul className="mt-2">
              {Array.from(new Set(nextSevenDays.map((occurrence) => occurrence.dutyDate))).map((dateKey, index, keys) => {
                const dayOccurrences = occurrencesByDate.get(dateKey) ?? [];
                return (
                  <li key={dateKey} style={index > 0 ? { borderTop: "1px solid var(--border-subtle)" } : undefined}>
                    <button
                      type="button"
                      onClick={() => openDay(dateKey)}
                      className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-[var(--surface-muted)] sm:px-5"
                      aria-label={`Ver plantões de ${formatDate(dateKey, { weekday: "long", day: "numeric", month: "long" })}`}
                    >
                      <p className="text-xs font-medium capitalize" style={{ color: "var(--text-muted)" }}>
                        {formatDate(dateKey, { weekday: "short", day: "numeric", month: "numeric" })}
                      </p>
                      {dayOccurrences.map((occurrence) => (
                        <div key={occurrence.id} className="mt-1 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>{occurrence.scheduleName}</span>
                          <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
                            {getOccurrenceTime(occurrence)}
                            {occurrence.inProgress && <Badge tone="success" size="sm">Em andamento</Badge>}
                            {occurrence.paused && <Badge tone="warning" size="sm">Pausado</Badge>}
                          </span>
                        </div>
                      ))}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <BottomSheet
        open={sheetDateKey !== null}
        onOpenChange={(open) => { if (!open) setSheetDateKey(null); }}
        title={selectedOccurrence ? selectedOccurrence.scheduleName : sheetDateLabel}
        description={selectedOccurrence
          ? "Detalhes do seu plantão. Esta visualização não altera a escala."
          : sheetOccurrences.length === 1
            ? "1 plantão nesta data"
            : `${sheetOccurrences.length} plantões nesta data`}
        className="arc-venancor"
      >
        {selectedOccurrence ? (
          <div className="space-y-4 px-4 pb-6 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedOccurrence(null)}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Voltar para a agenda do dia
            </Button>
            <div className="flex items-center gap-2">
              <Badge tone={selectedOccurrence.source === "published" ? "info" : "neutral"} size="sm">
                {sourceLabel(selectedOccurrence.source)}
              </Badge>
              {selectedOccurrence.inProgress && <Badge tone="success" size="sm">Em andamento</Badge>}
              {selectedOccurrence.paused && <Badge tone="warning" size="sm">Pausado</Badge>}
            </div>
            <div className="space-y-2 text-sm" style={{ color: "var(--foreground)" }}>
              <p className="capitalize" style={{ color: "var(--text-secondary)" }}>
                {formatDate(selectedOccurrence.dutyDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="flex items-center gap-2 tabular-nums">
                <Clock3 className="size-4" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                {getOccurrenceTime(selectedOccurrence)}
              </p>
              {selectedOccurrence.branchName && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                  {selectedOccurrence.branchName}
                </p>
              )}
            </div>
            {selectedOccurrence.paused && (
              <p className="px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, var(--warning) 8%, var(--surface))", borderRadius: "var(--radius-panel)", color: "var(--text-secondary)" }}>
                Este plantão está pausado temporariamente.
              </p>
            )}
          </div>
        ) : (
          <ul className="px-4 pb-6 pt-1">
            {sheetOccurrences.map((occurrence, index) => (
              <li key={occurrence.id} style={index > 0 ? { borderTop: "1px solid var(--border-subtle)" } : undefined}>
                <button
                  type="button"
                  onClick={() => setSelectedOccurrence(occurrence)}
                  className="w-full cursor-pointer py-3 text-left"
                  aria-label={`Ver plantão ${occurrence.scheduleName}, das ${getOccurrenceTime(occurrence)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>{occurrence.scheduleName}</span>
                    {occurrence.inProgress && <Badge tone="success" size="sm" className="shrink-0">Em andamento</Badge>}
                    {occurrence.paused && <Badge tone="warning" size="sm" className="shrink-0">Pausado</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Clock3 className="size-3.5" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                      {getOccurrenceTime(occurrence)}
                    </span>
                    {occurrence.branchName && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                        <span className="truncate">{occurrence.branchName}</span>
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </section>
  );
}
