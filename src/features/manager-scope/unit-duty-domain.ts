/**
 * Plantões da unidade do gestor (10/11). Regra: o gestor vê um plantão (numa data) quando pelo menos um corretor da
 * unidade dele está escalado nele, e dentro do plantão vê só os corretores da unidade. Nome, telefone ou contagem de
 * corretores de outras unidades nunca entram aqui. Em 10/11 todos os 270 plantões ativos da Âncora eram da empresa
 * toda (branch_id nulo) e 92% das ocorrências misturavam unidades, por isso o filtro é pelo corretor, não pelo plantão.
 * Funções puras: a consulta fica em unit-duty-queries.ts.
 */

export type UnitDutyRow = {
  scheduleId: string;
  scheduleName: string;
  scheduleValidFrom: Date;
  scheduleValidUntil: Date | null;
  brokerId: string;
  brokerName: string;
  /** "YYYY-MM-DD" da escala mensal publicada; null = escala semanal. */
  dutyDate: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  validFrom: Date;
  validUntil: Date | null;
  pausedAt: Date | null;
};

export type UnitDutyBroker = { id: string; name: string; startsAt: string; endsAt: string; paused: boolean };

export type UnitDutyOccurrence = {
  key: string;
  scheduleId: string;
  scheduleName: string;
  date: string;
  startsAt: string;
  endsAt: string;
  brokers: UnitDutyBroker[];
};

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" (America/Sao_Paulo) de hoje e dos próximos `count - 1` dias. */
export function unitDutyDays(now: Date, count: number): string[] {
  const days: string[] = [];
  for (let index = 0; index < count; index += 1) {
    days.push(DAY.format(new Date(now.getTime() + index * 24 * 60 * 60 * 1000)));
  }
  return [...new Set(days)];
}

function weekdayOf(day: string) {
  return new Date(`${day}T12:00:00-03:00`).getUTCDay();
}

function validOn(day: string, from: Date, until: Date | null) {
  const start = new Date(`${day}T00:00:00-03:00`);
  const end = new Date(`${day}T23:59:59.999-03:00`);
  return from <= end && (!until || until > start);
}

/**
 * Monta as ocorrências (plantão + data) a partir das escalas dos corretores da unidade. A escala mensal publicada
 * vence a semanal no mesmo plantão e data. Corretor fora de `unitBrokerIds` é descartado (defesa extra: a consulta
 * já filtra pela unidade).
 */
export function buildUnitDutyOccurrences(rows: readonly UnitDutyRow[], unitBrokerIds: ReadonlySet<string>, days: readonly string[]): UnitDutyOccurrence[] {
  const daySet = new Set(days);
  const inUnit = rows.filter((row) => unitBrokerIds.has(row.brokerId));
  const datedPairs = new Set(inUnit.filter((row) => row.dutyDate && daySet.has(row.dutyDate)).map((row) => `${row.scheduleId}|${row.dutyDate}`));
  const occurrences = new Map<string, UnitDutyOccurrence>();
  const add = (row: UnitDutyRow, day: string) => {
    if (!validOn(day, row.scheduleValidFrom, row.scheduleValidUntil)) return;
    const key = `${row.scheduleId}|${day}`;
    const occurrence = occurrences.get(key) ?? { key, scheduleId: row.scheduleId, scheduleName: row.scheduleName, date: day, startsAt: row.startsAt, endsAt: row.endsAt, brokers: [] };
    if (occurrence.brokers.some((broker) => broker.id === row.brokerId)) return;
    occurrence.brokers.push({ id: row.brokerId, name: row.brokerName, startsAt: row.startsAt, endsAt: row.endsAt, paused: Boolean(row.pausedAt) });
    if (row.startsAt < occurrence.startsAt) occurrence.startsAt = row.startsAt;
    if (row.endsAt > occurrence.endsAt) occurrence.endsAt = row.endsAt;
    occurrences.set(key, occurrence);
  };
  for (const row of inUnit) {
    if (row.dutyDate) {
      if (daySet.has(row.dutyDate)) add(row, row.dutyDate);
      continue;
    }
    for (const day of days) {
      if (weekdayOf(day) !== row.dayOfWeek || datedPairs.has(`${row.scheduleId}|${day}`)) continue;
      if (!validOn(day, row.validFrom, row.validUntil)) continue;
      add(row, day);
    }
  }
  return [...occurrences.values()]
    .map((occurrence) => ({ ...occurrence, brokers: [...occurrence.brokers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt) || a.scheduleName.localeCompare(b.scheduleName, "pt-BR"));
}
