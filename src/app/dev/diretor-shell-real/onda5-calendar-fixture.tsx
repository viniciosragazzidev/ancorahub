"use client";

import { useMemo } from "react";
import { DutyMonthCalendar } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/duty-month-calendar";

const baseDate = new Date("2026-10-26T03:00:00.000Z");
const schedules = Array.from({ length: 8 }, (_, index) => ({
  id: `demo-duty-${index + 1}`,
  name: [
    "Plantão PRESENCIAL TARDE · Unidade Centro",
    "Plantão PRESENCIAL MANHÃ · Unidade Centro",
    "Plantão ONLINE · Unidade Centro",
    "Plantão de suporte · Unidade Centro",
    "Plantão PRESENCIAL TARDE · Zona Norte",
    "Plantão PRESENCIAL MANHÃ · Zona Norte",
    "Plantão ONLINE · Zona Norte",
    "Plantão especial · Unidade Sul",
  ][index]!,
  startsAt: index % 2 ? "13:30" : "08:30",
  endsAt: index % 2 ? "19:00" : "13:30",
  status: "active",
  validFrom: baseDate,
  validUntil: null,
  typeName: index % 2 ? "Presencial" : "Online",
  typeHue: index % 2 ? 210 : 165,
}));

const progressById = new Map(schedules.map((schedule, index) => [schedule.id, {
  dates: [
    { date: "2026-10-26", done: false },
    ...(index < 3 ? [{ date: "2026-10-27", done: false }] : []),
    ...(index === 2 ? [{ date: "2026-10-28", done: true }] : []),
  ],
}]));

export function Onda5CalendarFixture() {
  const published = useMemo(() => new Set(schedules.slice(0, 4).map((schedule) => schedule.id)), []);
  const drafts = useMemo(() => new Set(schedules.slice(4, 6).map((schedule) => schedule.id)), []);
  const gaps = useMemo(() => new Set([schedules[6]!.id]), []);

  return (
    <DutyMonthCalendar
      month="2026-10"
      schedules={schedules}
      progressById={progressById}
      publishedScheduleIds={published}
      draftScheduleIds={drafts}
      gapScheduleIds={gaps}
      repeatingScheduleIds={new Set(schedules.map((schedule) => schedule.id))}
      canCreate
      onOpen={() => undefined}
      onCreateOnDate={() => undefined}
    />
  );
}
