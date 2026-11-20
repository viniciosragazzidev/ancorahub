/** Intervalo personalizado do Painel (data e hora de início e fim), no formato de `leadQualityRange`. Servidor e cliente. */
export type CustomRange = { from: string; fromTime: string | null; to: string; toTime: string | null };

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Rótulo do intervalo escolhido: "01/10 08:00 – 13/10 18:00". */
export function customRangeLabel(range: CustomRange) {
  return `${shortDay(range.from)}${range.fromTime ? ` ${range.fromTime}` : ""} – ${shortDay(range.to)}${range.toTime ? ` ${range.toTime}` : ""}`;
}

/** `?periodo=` de um intervalo personalizado ("2026-10-01T08:00_2026-10-13T18:00"). */
export function rangeParam(range: CustomRange) {
  return `${range.from}${range.fromTime ? `T${range.fromTime}` : ""}_${range.to}${range.toTime ? `T${range.toTime}` : ""}`;
}
