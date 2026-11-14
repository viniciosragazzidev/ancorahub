"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BrokerDutyHub } from "@/features/broker-workspace/components/broker-duty-hub";
import type { BrokerDutyCalendarOccurrence } from "@/features/broker-workspace/duty-calendar";
import type { DutyHubCurrent, DutyHubShift } from "@/features/broker-workspace/duty-hub";

/** Dev-only showcase of the broker Plantões with example data. /dev/plantoes?estado=next|active|none */
const shift: DutyHubShift = {
  key: "s1", scheduleName: "Plantão PME Centro", dateLabel: "Hoje", timeLabel: "13:00 às 17:00", place: "Unidade Centro", modality: "Online",
  situation: { label: "Confirmado", tone: "success" }, hint: "Fique disponível: os leads chegam por ordem de quem aceita primeiro.", href: "/plantoes/agora",
};
const occurrence = (day: string, name: string, start: string, end: string): BrokerDutyCalendarOccurrence => ({
  id: `o-${day}-${start}`, assignmentId: "a", scheduleId: "s", scheduleName: name, branchName: "Unidade Centro", dutyDate: `2026-11-${day}`,
  startsAt: `${start}:00`, endsAt: `${end}:00`, source: "weekly", paused: false, inProgress: false, endsNextDay: false,
});

function Showcase() {
  const state = useSearchParams().get("estado") ?? "next";
  const current: DutyHubCurrent = state === "none" ? { state: "none", shifts: [], coveredOccurrenceIds: [] }
    : state === "active" ? { state: "active", shifts: [shift], coveredOccurrenceIds: [] }
      : { state: "next", shifts: [{ ...shift, dateLabel: "Amanhã", situation: { label: "Próximo plantão", tone: "neutral" }, hint: null, href: null }], coveredOccurrenceIds: [] };
  const occurrences = state === "none" ? [] : [occurrence("17", "Plantão PME Centro", "13:00", "17:00"), occurrence("19", "Plantão Individual", "09:00", "13:00"), occurrence("21", "Plantão PME Centro", "13:00", "17:00")];
  return <BrokerDutyHub current={current} calendarState="ready"
    calendar={{ todayKey: "2026-11-14", firstMonthKey: "2026-11", monthCount: 2, endExclusiveKey: "2027-01-01", occurrences }} />;
}

export default function DutyShowcasePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <main className="arc-venancor"><Suspense fallback={null}><Showcase /></Suspense></main>;
}
