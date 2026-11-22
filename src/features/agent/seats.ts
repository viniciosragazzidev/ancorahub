import type { SeatOccurrence } from "./types";

/**
 * "Dê 5 cadeiras para a Ana" (A1): as próximas vagas livres dos plantões em que ela ainda não está,
 * uma por plantão, sem dois plantões no mesmo horário. Puro e testado; o servidor confere tudo de novo na hora de gravar.
 */
export type SeatFilters = {
  /** 0 = domingo … 6 = sábado */
  weekdays?: number[];
  typeId?: string | null;
  /** Parte do nome do plantão ou do tipo ("PME", "presencial"). */
  scheduleText?: string | null;
  attendanceMode?: "online" | "presencial" | null;
  shift?: "manha" | "tarde" | "noite" | null;
  /** AAAA-MM-DD, inclusive */
  from?: string | null;
  until?: string | null;
  /** Aceitar plantão cujo tipo não inclui a unidade da pessoa (o diretor confirma). */
  includeOutsideType?: boolean;
  /** Cadeiras no mesmo dia. Padrão 1: "5 cadeiras" são 5 dias, não um dia de manhã, tarde e noite. */
  maxPerDay?: number;
};

export type SeatChoice = { occurrence: SeatOccurrence; outsideType: boolean };

export type SeatPick = {
  picked: SeatChoice[];
  /** Quantas vagas livres havia no total (para dizer "só achei 3"). */
  available: number;
  /** Vagas que só serviriam com "escalar fora do tipo". */
  outsideTypeAvailable: number;
};

const WEEKDAY_LABEL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function hhmm(value: string) {
  return value.slice(0, 5);
}

export function weekdayOf(dutyDate: string) {
  return new Date(`${dutyDate}T12:00:00Z`).getUTCDay();
}

/** "sáb 22/11, 09:00–13:00, Plantão PME" */
export function seatLabel(occurrence: Pick<SeatOccurrence, "dutyDate" | "startsAt" | "endsAt" | "scheduleName">) {
  const day = `${occurrence.dutyDate.slice(8, 10)}/${occurrence.dutyDate.slice(5, 7)}`;
  return `${WEEKDAY_LABEL[weekdayOf(occurrence.dutyDate)]} ${day}, ${hhmm(occurrence.startsAt)}–${hhmm(occurrence.endsAt)}, ${occurrence.scheduleName}`;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** Manhã começa antes das 12h; tarde entre 12h e 18h; noite das 18h em diante. */
export function shiftOf(startsAt: string): "manha" | "tarde" | "noite" {
  const start = minutes(startsAt);
  if (start < 12 * 60) return "manha";
  if (start < 18 * 60) return "tarde";
  return "noite";
}

function interval(occurrence: Pick<SeatOccurrence, "dutyDate" | "startsAt" | "endsAt">) {
  const day = Date.parse(`${occurrence.dutyDate}T00:00:00Z`) / 60_000;
  const start = day + minutes(occurrence.startsAt);
  let end = day + minutes(occurrence.endsAt);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function overlaps(a: SeatOccurrence, b: SeatOccurrence) {
  const x = interval(a);
  const y = interval(b);
  return x.start < y.end && y.start < x.end;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Filtro por turno e por parte do nome do plantão ou do tipo ("manhã", "PME"). */
export function matchesSeat(occurrence: Pick<SeatOccurrence, "startsAt" | "scheduleName" | "typeName">, filter: { shift?: "manha" | "tarde" | "noite" | null; text?: string | null }) {
  if (filter.shift && shiftOf(occurrence.startsAt) !== filter.shift) return false;
  if (filter.text && !normalize(`${occurrence.scheduleName} ${occurrence.typeName ?? ""}`).includes(normalize(filter.text))) return false;
  return true;
}

export function hasFreeSeat(occurrence: SeatOccurrence) {
  return occurrence.maximumBrokers === null || occurrence.brokerIds.length < occurrence.maximumBrokers;
}

export function pickSeats(occurrences: readonly SeatOccurrence[], brokerId: string, quantity: number, filters: SeatFilters = {}): SeatPick {
  const sorted = [...occurrences].sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || minutes(a.startsAt) - minutes(b.startsAt) || a.scheduleName.localeCompare(b.scheduleName, "pt-BR"));
  // Onde ela já está: não repete o plantão e não pega outro no mesmo horário.
  const mine = sorted.filter((occurrence) => occurrence.brokerIds.includes(brokerId));
  const text = filters.scheduleText ? normalize(filters.scheduleText) : null;
  const candidates = sorted.filter((occurrence) => {
    if (occurrence.started || occurrence.ended) return false;
    if (occurrence.brokerIds.includes(brokerId)) return false;
    if (!hasFreeSeat(occurrence)) return false;
    if (filters.weekdays?.length && !filters.weekdays.includes(weekdayOf(occurrence.dutyDate))) return false;
    if (filters.typeId && occurrence.typeId !== filters.typeId) return false;
    if (filters.attendanceMode && occurrence.attendanceMode !== filters.attendanceMode) return false;
    if (filters.shift && shiftOf(occurrence.startsAt) !== filters.shift) return false;
    if (filters.from && occurrence.dutyDate < filters.from) return false;
    if (filters.until && occurrence.dutyDate > filters.until) return false;
    if (text && !normalize(`${occurrence.scheduleName} ${occurrence.typeName ?? ""}`).includes(text)) return false;
    return !mine.some((taken) => overlaps(taken, occurrence));
  });
  const inside = candidates.filter((occurrence) => occurrence.allowedBrokerIds.includes(brokerId));
  const outside = candidates.filter((occurrence) => !occurrence.allowedBrokerIds.includes(brokerId));
  const pool = filters.includeOutsideType ? candidates : inside;
  const picked: SeatChoice[] = [];
  const perDay = Math.max(1, filters.maxPerDay ?? 1);
  // Dias em que ela já tem cadeira contam para o limite do dia.
  const dayCount = (dutyDate: string) => mine.filter((taken) => taken.dutyDate === dutyDate).length + picked.filter((choice) => choice.occurrence.dutyDate === dutyDate).length;
  for (const occurrence of pool) {
    if (picked.length >= quantity) break;
    if (dayCount(occurrence.dutyDate) >= perDay) continue;
    if (picked.some((choice) => overlaps(choice.occurrence, occurrence))) continue;
    picked.push({ occurrence, outsideType: !occurrence.allowedBrokerIds.includes(brokerId) });
  }
  return { picked, available: pool.length, outsideTypeAvailable: filters.includeOutsideType ? 0 : outside.length };
}

/** Quantas cadeiras a pessoa tem no período (A14: "quantas cadeiras a Ana tem no mês?"). */
export function seatsOf(occurrences: readonly SeatOccurrence[], brokerId: string, now: Date) {
  const today = now.toISOString().slice(0, 10);
  const mine = occurrences.filter((occurrence) => occurrence.brokerIds.includes(brokerId));
  return {
    total: mine.length,
    next: mine.filter((occurrence) => !occurrence.ended && occurrence.dutyDate >= today).sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || minutes(a.startsAt) - minutes(b.startsAt)),
  };
}

/** Plantões com menos gente que o mínimo (A14: "onde falta gente?"). */
export function understaffed(occurrences: readonly SeatOccurrence[]) {
  return occurrences.filter((occurrence) => !occurrence.ended && occurrence.brokerIds.length < occurrence.minimumBrokers);
}
