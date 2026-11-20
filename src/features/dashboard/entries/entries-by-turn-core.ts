/**
 * Entradas de leads por turno, separadas por canal (pedido do Vinicios, 20/11/2026).
 * Dia de operação: das 19h às 19h (sábado e domingo entram no dia de sexta). Dentro do dia, os dois turnos do
 * sistema (LEAD_SHIFTS): Turno 1 das 19h às 13h30 e Turno 2 das 13h30 às 19h. Cada turno separado em WhatsApp,
 * formulário e outros (manual e importação). Puro e testável: recebe as contagens agregadas e o início de cada dia.
 */
export type EntryChannel = "whatsapp" | "form" | "other";
export type EntryShift = 1 | 2;

export type HourlyEntryRow = { hour: Date; shift: EntryShift; channel: EntryChannel; total: number };

export type ChannelCounts = { whatsapp: number; form: number; other: number; total: number };

export type DayEntries = {
  /** Início do dia de operação (19h de São Paulo). */
  start: Date;
  shifts: Record<EntryShift, ChannelCounts>;
  total: ChannelCounts;
};

export type EntriesByTurn = {
  days: DayEntries[];
  shifts: Record<EntryShift, ChannelCounts>;
  totals: ChannelCounts;
};

export const SHIFT_LABELS: Record<EntryShift, { label: string; hours: string }> = {
  1: { label: "Turno 1", hours: "19h – 13h30" },
  2: { label: "Turno 2", hours: "13h30 – 19h" },
};

const empty = (): ChannelCounts => ({ whatsapp: 0, form: 0, other: 0, total: 0 });
const add = (target: ChannelCounts, channel: EntryChannel, value: number) => {
  target[channel] += value;
  target.total += value;
};

/**
 * Soma as linhas no dia (via `dayOf`) e no turno de cada uma. Os dias saem do mais recente para o mais antigo;
 * dias sem entrada aparecem zerados. Linhas fora dos dias pedidos são ignoradas.
 */
export function bucketEntriesByTurn(rows: readonly HourlyEntryRow[], dayStarts: readonly Date[], dayOf: (date: Date) => Date): EntriesByTurn {
  const byStart = new Map<number, DayEntries>();
  for (const start of dayStarts) byStart.set(start.getTime(), { start, shifts: { 1: empty(), 2: empty() }, total: empty() });
  const shifts: Record<EntryShift, ChannelCounts> = { 1: empty(), 2: empty() };
  const totals = empty();
  for (const row of rows) {
    const day = byStart.get(dayOf(row.hour).getTime());
    if (!day) continue;
    add(day.shifts[row.shift], row.channel, row.total);
    add(day.total, row.channel, row.total);
    add(shifts[row.shift], row.channel, row.total);
    add(totals, row.channel, row.total);
  }
  const days = [...byStart.values()].sort((a, b) => b.start.getTime() - a.start.getTime());
  return { days, shifts, totals };
}

/** "qui 19/11" no fuso da operação: o dia em que o dia de operação começou às 19h. */
export function dayLabel(start: Date, timeZone = "America/Sao_Paulo"): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short" }).format(start).replace(".", "");
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(start);
  return `${weekday} ${day}`;
}

export const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** CSV da tabela (exportar é coisa de todo CRM): ";" para abrir direto no Excel em pt-BR. */
export function entriesCsv(data: EntriesByTurn): string {
  const lines = ["Dia;Turno 1 WhatsApp;Turno 1 Formulário;Turno 1 Outros;Turno 2 WhatsApp;Turno 2 Formulário;Turno 2 Outros;Total"];
  const row = (label: string, shifts: Record<EntryShift, ChannelCounts>, total: number) =>
    [label, shifts[1].whatsapp, shifts[1].form, shifts[1].other, shifts[2].whatsapp, shifts[2].form, shifts[2].other, total].join(";");
  for (const day of data.days) lines.push(row(dayLabel(day.start), day.shifts, day.total.total));
  lines.push(row("Total", data.shifts, data.totals.total));
  return lines.join("\n");
}
