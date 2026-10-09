"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { ChevronDownIcon } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { getTeamMemberProfile } from "@/features/team/member-profile";
import { queueHueToDotColor } from "@/features/lead-distribution/queue-color";
import { cn } from "@/lib/utils";

type DutyDay = NonNullable<Awaited<ReturnType<typeof getTeamMemberProfile>>>["dutyDays"][number];

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;
const PRESENCE: Record<NonNullable<DutyDay["presence"]>, { label: string; variant: "success" | "warning" | "destructive" }> = {
  confirmed: { label: "Presença confirmada", variant: "success" },
  pending: { label: "Presença pendente", variant: "warning" },
  absent: { label: "Faltou", variant: "destructive" },
};

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function dayLabel(key: string) {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  return label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);
}

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Small month calendar of the broker's plantões: each duty day is marked with
 * its plantão type color; hovering (or focusing) a day opens a floating card
 * with what happened (or will happen) on it.
 */
export function MemberDutyCalendar({ days }: { days: DutyDay[] }) {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const byDate = useMemo(() => {
    const map = new Map<string, DutyDay[]>();
    for (const day of days) map.set(day.date, [...(map.get(day.date) ?? []), day]);
    return map;
  }, [days]);
  const months = useMemo(() => [...new Set(days.map((day) => day.date.slice(0, 7)))].sort(), [days]);
  const first = months[0] && months[0] < today.slice(0, 7) ? months[0] : today.slice(0, 7);
  const last = months.at(-1) && months.at(-1)! > today.slice(0, 7) ? months.at(-1)! : today.slice(0, 7);

  const cells = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const list: Array<string | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`)];
    while (list.length % 7) list.push(null);
    return list;
  }, [month]);

  const monthDays = days.filter((day) => day.date.startsWith(month));
  const upcoming = days.filter((day) => day.state !== "done").slice(0, 3);

  return (
    <section aria-label="Plantões do corretor" className="rounded-[var(--radius-card-lg,16px)] border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Plantões</h2>
          <p className="text-xs text-muted-foreground tabular-nums">{monthLabel(month)} · {monthDays.length} {monthDays.length === 1 ? "plantão" : "plantões"}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Mês anterior" disabled={month <= first} onClick={() => setMonth(shiftMonth(month, -1))}><ChevronDownIcon className="size-4 rotate-90" /></Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Próximo mês" disabled={month >= last} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronDownIcon className="size-4 -rotate-90" /></Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={`Calendário de ${monthLabel(month)}`}>
        {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} role="columnheader" className="pb-1 text-[10px] font-semibold text-muted-foreground">{day}</span>)}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} aria-hidden="true" />;
          const items = byDate.get(date) ?? [];
          const isToday = date === today;
          const past = date < today;
          const number = Number(date.slice(8, 10));
          if (!items.length) {
            return (
              <span key={date} role="gridcell" className={cn("grid aspect-square place-items-center rounded-md text-xs tabular-nums", past ? "text-muted-foreground/60" : "text-muted-foreground", isToday && "ring-1 ring-inset ring-primary/60 text-foreground")}>
                {number}
              </span>
            );
          }
          const hue = items[0].typeHue;
          return (
            <Popover key={date}>
              <PopoverTrigger
                openOnHover
                delay={120}
                role="gridcell"
                aria-label={`${dayLabel(date)}: ${items.map((item) => item.scheduleName).join(", ")}`}
                className={cn(
                  "relative grid aspect-square place-items-center rounded-md border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  past ? "border-transparent bg-muted text-muted-foreground" : "border-transparent text-foreground",
                  isToday && "ring-2 ring-inset ring-primary/60",
                )}
                style={past ? undefined : { backgroundColor: `color-mix(in oklab, ${queueHueToDotColor(hue)} 18%, transparent)` }}
              >
                {number}
                <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
                  {items.slice(0, 3).map((item) => <span key={item.scheduleId} className="size-1 rounded-full" style={{ backgroundColor: queueHueToDotColor(item.typeHue) }} />)}
                </span>
              </PopoverTrigger>
              <PopoverContent side="left" align="center" className="w-72 p-3">
                <p className="text-xs font-semibold text-muted-foreground">{dayLabel(date)}</p>
                <ul className="mt-2 grid gap-2.5">
                  {items.map((item) => (
                    <li key={item.scheduleId} className="rounded-[var(--radius-card)] border border-border/70 p-2.5" style={{ borderLeftColor: queueHueToDotColor(item.typeHue), borderLeftWidth: 3 }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/leads/distribuicao/plantao/${item.scheduleId}${item.state === "done" ? `?data=${item.date}` : ""}`} className="block truncate text-sm font-medium underline-offset-4 hover:underline">{item.scheduleName}</Link>
                          <p className="text-xs text-muted-foreground">{item.startsAt}–{item.endsAt} · {item.typeName ?? "Sem tipo"} · {item.attendanceMode === "presencial" ? "Presencial" : "Online"}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">{item.state === "done" ? "Encerrado" : item.state === "today" ? "Hoje" : "Agendado"}</Badge>
                      </div>
                      {item.state !== "upcoming" ? (
                        <dl className="mt-2 grid grid-cols-3 gap-1 text-center">
                          <div className="rounded-md bg-muted/50 py-1"><dt className="text-[10px] text-muted-foreground">Leads</dt><dd className="font-mono text-sm font-semibold tabular-nums">{item.leads}</dd></div>
                          <div className="rounded-md bg-muted/50 py-1"><dt className="text-[10px] text-muted-foreground">Ofertas</dt><dd className="font-mono text-sm font-semibold tabular-nums">{item.offersSent}</dd></div>
                          <div className="rounded-md bg-muted/50 py-1"><dt className="text-[10px] text-muted-foreground">Aceitas</dt><dd className="font-mono text-sm font-semibold tabular-nums">{item.offersAccepted}</dd></div>
                        </dl>
                      ) : null}
                      {item.presence ? <Badge variant={PRESENCE[item.presence].variant} className="mt-2">{PRESENCE[item.presence].label}</Badge> : null}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border/70 pt-3">
        <p className="text-xs font-semibold text-muted-foreground">Próximos plantões</p>
        {upcoming.length ? (
          <ul className="mt-2 grid gap-1.5">
            {upcoming.map((item) => (
              <li key={`${item.date}:${item.scheduleId}`} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: queueHueToDotColor(item.typeHue) }} />
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{item.date.slice(8, 10)}/{item.date.slice(5, 7)}</span>
                <span className="min-w-0 flex-1 truncate">{item.scheduleName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{item.startsAt}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-xs text-muted-foreground">Nenhum plantão agendado.</p>}
      </div>
    </section>
  );
}
