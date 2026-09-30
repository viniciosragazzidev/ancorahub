"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetSection,
  SheetSectionHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  BrokerDutyCalendarOccurrence,
  BrokerDutyCalendarResult,
} from "../duty-calendar";
import styles from "./light-duty-calendar-motion.module.css";

type LightDutyCalendarProps = { calendar: BrokerDutyCalendarResult };

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

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
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
  const [selectedOccurrence, setSelectedOccurrence] = useState<BrokerDutyCalendarOccurrence | null>(null);
  const [agendaOpen, setAgendaOpen] = useState(true);
  const pendingFrame = useRef<number | null>(null);

  useEffect(() => () => {
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
  }, []);

  const occurrencesByDate = useMemo(() => {
    const result = new Map<string, BrokerDutyCalendarOccurrence[]>();
    for (const occurrence of calendar.occurrences) {
      const day = result.get(occurrence.dutyDate) ?? [];
      day.push(occurrence);
      result.set(occurrence.dutyDate, day);
    }
    return result;
  }, [calendar.occurrences]);

  const selectedOccurrences = occurrencesByDate.get(selectedDateKey) ?? [];
  const markedDates = useMemo(
    () => [...occurrencesByDate.keys()].map(localDateFromKey),
    [occurrencesByDate],
  );

  function chooseDate(dateKey: string) {
    setSelectedDateKey(dateKey);
    setAgendaOpen(false);
    if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => setAgendaOpen(true));
  }

  function chooseOccurrenceDate(dateKey: string) {
    setVisibleMonth(monthFromKey(dateKey));
    chooseDate(dateKey);
  }

  function onMonthChange(month: Date) {
    setVisibleMonth(month);
    const targetMonthKey = getMonthKey(month);
    if (getMonthKey(localDateFromKey(selectedDateKey)) === targetMonthKey) return;
    const firstDatedOccurrence = calendar.occurrences.find((occurrence) => occurrence.dutyDate.startsWith(targetMonthKey.slice(0, 7)));
    const firstDay = `${targetMonthKey.slice(0, 7)}-01`;
    const nextSelection = firstDatedOccurrence?.dutyDate ?? (firstDay < calendar.todayKey ? calendar.todayKey : firstDay);
    chooseDate(nextSelection);
  }

  function jumpToToday() {
    setVisibleMonth(monthFromKey(calendar.todayKey));
    chooseDate(calendar.todayKey);
  }

  const monthLabel = formatDate(`${getMonthKey(visibleMonth).slice(0, 7)}-01`, { month: "long", year: "numeric" });
  const selectedDateLabel = formatDate(selectedDateKey, { weekday: "long", day: "numeric", month: "long" });
  const firstUpcoming = calendar.occurrences[0];

  return (
    <section aria-labelledby="duty-calendar-page-title" className="mx-auto w-full max-w-7xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <span>Sua escala, de um jeito simples</span>
          </div>
          <h1 id="duty-calendar-page-title" className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Plantões</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Confira seus próximos horários e toque em uma data para ver os detalhes.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 px-3 py-1.5 text-xs">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {calendar.occurrences.length} {calendar.occurrences.length === 1 ? "plantão no período" : "plantões no período"}
        </Badge>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(19rem,0.98fr)] lg:gap-5">
        <Card role="region" className="min-w-0 overflow-hidden" aria-label="Calendário dos seus plantões">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Calendário</CardTitle>
              <CardDescription className="mt-1 capitalize">{monthLabel}</CardDescription>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={jumpToToday}>
              Hoje
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="-mx-1 overflow-x-auto sm:mx-0">
              <Calendar
                aria-label="Calendário dos seus plantões"
                mode="single"
                month={visibleMonth}
                onMonthChange={onMonthChange}
                selected={localDateFromKey(selectedDateKey)}
                onSelect={(date) => date && chooseDate(dateKeyFromLocalDate(date))}
                startMonth={monthFromKey(calendar.firstMonthKey)}
                endMonth={finalVisibleDate(calendar.endExclusiveKey)}
                disabled={{ before: localDateFromKey(calendar.todayKey) }}
                showOutsideDays={false}
                weekStartsOn={1}
                modifiers={{ hasDuty: markedDates }}
                modifiersClassNames={{
                  hasDuty: "after:absolute after:bottom-1 after:left-1/2 after:z-20 after:size-1.5 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']",
                }}
                className="mx-auto w-full p-2 [--cell-size:2.5rem] min-[380px]:[--cell-size:2.75rem] sm:[--cell-size:3rem]"
              />
            </div>
            <div className="flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              <span>Dia com plantão escalado</span>
              <span className="ml-auto">Toque em uma data para filtrar</span>
            </div>
          </CardContent>
        </Card>

        <section
          aria-labelledby="agenda-title"
          aria-live="polite"
          aria-busy={!agendaOpen}
          className={cn(styles.agendaReveal, "min-w-0 space-y-4")}
          data-open={agendaOpen}
        >
          <div className="flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Sua agenda</p>
              <h2 id="agenda-title" className="mt-1 truncate font-heading text-lg font-semibold capitalize text-foreground">
                {selectedDateLabel}
              </h2>
            </div>
            {selectedOccurrences.length > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {selectedOccurrences.length} {selectedOccurrences.length === 1 ? "horário" : "horários"}
              </Badge>
            )}
          </div>

          {selectedOccurrences.length > 0 ? (
            <div className="space-y-3">
              {selectedOccurrences.map((occurrence, index) => (
                <button
                  key={occurrence.id}
                  type="button"
                  onClick={() => setSelectedOccurrence(occurrence)}
                  className={cn(
                    "group flex min-h-28 w-full flex-col gap-4 rounded-[var(--radius-card)] border p-4 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-0 motion-reduce:transition-none sm:p-5",
                    index === 0
                      ? "border-primary/20 bg-primary/[0.045]"
                      : "border-border bg-card hover:bg-muted/35",
                  )}
                  aria-label={`Ver plantão ${occurrence.scheduleName}, das ${getOccurrenceTime(occurrence)}`}
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {index === 0 && firstUpcoming?.id === occurrence.id ? (
                          <><Sparkles className="size-3.5 text-primary" aria-hidden="true" /> Próximo plantão</>
                        ) : index === 0 ? "Plantão em foco" : "Outro plantão"}
                      </span>
                      <span className="mt-1.5 block truncate font-heading text-base font-semibold text-foreground sm:text-lg">
                        {occurrence.scheduleName}
                      </span>
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-primary ring-1 ring-border/70 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {getOccurrenceTime(occurrence)}
                    </span>
                    {occurrence.branchName && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{occurrence.branchName}</span>
                      </span>
                    )}
                    {occurrence.inProgress && <Badge variant="success" className="ml-auto">Em andamento</Badge>}
                    {occurrence.paused && <Badge variant="warning" className="ml-auto">Pausado</Badge>}
                  </span>
                </button>
              ))}
            </div>
          ) : calendar.occurrences.length === 0 ? (
            <Card variant="subtle" className="items-center px-5 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-2xl bg-background text-muted-foreground ring-1 ring-border/70">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <CardTitle className="mt-3 text-base">Nenhum plantão próximo</CardTitle>
              <CardDescription className="max-w-xs leading-5">
                Quando você estiver em uma escala ativa, os próximos horários vão aparecer aqui.
              </CardDescription>
            </Card>
          ) : (
            <Card variant="subtle" className="items-start gap-3 p-5">
              <CardTitle className="text-base">Sem plantão nesta data</CardTitle>
              <CardDescription className="leading-5">
                Escolha um dia marcado no calendário ou veja sua próxima escala.
              </CardDescription>
              {firstUpcoming && (
                <Button type="button" size="sm" variant="outline" onClick={() => chooseOccurrenceDate(firstUpcoming.dutyDate)}>
                  Próximo plantão <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
                </Button>
              )}
            </Card>
          )}
        </section>
      </div>

      <Sheet open={selectedOccurrence !== null} onOpenChange={(open) => !open && setSelectedOccurrence(null)}>
        <SheetContent side="right" aria-describedby="duty-sheet-description">
          {selectedOccurrence && (
            <>
              <SheetHeader>
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-4" aria-hidden="true" />
                  </span>
                  <Badge variant={selectedOccurrence.source === "published" ? "info" : "outline"}>
                    {sourceLabel(selectedOccurrence.source)}
                  </Badge>
                </div>
                <SheetTitle className="pr-2 text-lg">{selectedOccurrence.scheduleName}</SheetTitle>
                <SheetDescription id="duty-sheet-description">
                  Detalhes do seu plantão. Esta visualização não altera a escala.
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                <SheetSection>
                  <SheetSectionHeader>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Data e horário</p>
                      <p className="mt-1 font-medium capitalize text-foreground">
                        {formatDate(selectedOccurrence.dutyDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    {selectedOccurrence.inProgress && <Badge variant="success">Em andamento</Badge>}
                  </SheetSectionHeader>
                  <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-foreground">
                    <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="tabular-nums">{getOccurrenceTime(selectedOccurrence)}</span>
                  </div>
                  {selectedOccurrence.branchName && (
                    <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3.5 text-sm text-foreground">
                      <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>{selectedOccurrence.branchName}</span>
                    </div>
                  )}
                </SheetSection>
                {selectedOccurrence.paused && (
                  <p className="mt-4 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5 text-sm text-muted-foreground">
                    Este plantão está pausado temporariamente.
                  </p>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
