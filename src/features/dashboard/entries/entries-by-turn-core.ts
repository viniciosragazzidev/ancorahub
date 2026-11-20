/**
 * Entradas de leads por turno, separadas por canal (pedido do Vinicios, 20/11/2026): quanto entrou em cada turno
 * (dia de operação das 19h às 19h; sábado e domingo entram no turno de sexta) por WhatsApp e por formulário.
 * Puro e testável: recebe as contagens por hora e o início de cada turno.
 */
export type EntryChannel = "whatsapp" | "form" | "other";

export type HourlyEntryRow = { hour: Date; channel: EntryChannel; total: number };

export type TurnEntries = {
  /** Início do turno (19h de São Paulo). */
  start: Date;
  whatsapp: number;
  form: number;
  other: number;
  total: number;
};

export type EntriesByTurn = {
  turns: TurnEntries[];
  totals: Omit<TurnEntries, "start">;
};

/**
 * Soma as horas no turno a que pertencem. `turnOf` devolve o início do turno de um instante (a mesma regra do painel).
 * Os turnos saem do mais recente para o mais antigo; turnos sem entrada aparecem zerados (entre `since` e `now`).
 */
export function bucketEntriesByTurn(rows: readonly HourlyEntryRow[], turnStarts: readonly Date[], turnOf: (date: Date) => Date): EntriesByTurn {
  const byStart = new Map<number, TurnEntries>();
  for (const start of turnStarts) byStart.set(start.getTime(), { start, whatsapp: 0, form: 0, other: 0, total: 0 });
  for (const row of rows) {
    const key = turnOf(row.hour).getTime();
    const turn = byStart.get(key);
    if (!turn) continue;
    turn[row.channel] += row.total;
    turn.total += row.total;
  }
  const turns = [...byStart.values()].sort((a, b) => b.start.getTime() - a.start.getTime());
  const totals = turns.reduce(
    (sum, turn) => ({ whatsapp: sum.whatsapp + turn.whatsapp, form: sum.form + turn.form, other: sum.other + turn.other, total: sum.total + turn.total }),
    { whatsapp: 0, form: 0, other: 0, total: 0 },
  );
  return { turns, totals };
}

/** "sex 20/11" no fuso da operação: o dia em que o turno começou às 19h. */
export function turnLabel(start: Date, timeZone = "America/Sao_Paulo"): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short" }).format(start).replace(".", "");
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit" }).format(start);
  return `${weekday} ${day}`;
}

export const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** CSV da tabela por turno (exportar é coisa de todo CRM): separador ";" para abrir direto no Excel em pt-BR. */
export function entriesCsv(data: EntriesByTurn): string {
  const lines = ["Turno (início 19h);WhatsApp;Formulário;Outros;Total"];
  for (const turn of data.turns) lines.push([turnLabel(turn.start), turn.whatsapp, turn.form, turn.other, turn.total].join(";"));
  lines.push(["Total", data.totals.whatsapp, data.totals.form, data.totals.other, data.totals.total].join(";"));
  return lines.join("\n");
}
