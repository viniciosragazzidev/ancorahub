/**
 * Pulso do painel (27/11/2026, desenho "Painel da gestão no estilo do corretor"): os quatro números do período
 * (entraram, qualificados, distribuídos, vendas) com as mini barras ao longo da janela, e as entradas por hora do
 * dia, WhatsApp x formulário. Puro: recebe as contagens agregadas por faixa.
 */
export const PULSE_BUCKETS = 12;
/** Faixa do gráfico "Entradas por hora": das 06h às 19h (14 colunas). */
export const PULSE_FIRST_HOUR = 6;
export const PULSE_LAST_HOUR = 19;

export type PulseHour = { hour: number; whatsapp: number; form: number };

export type DashboardPulse = {
  /** Contagem por faixa da janela, da mais antiga para a mais recente (12 faixas). */
  arrived: number[];
  qualified: number[];
  distributed: number[];
  sales: number[];
  distributedTotal: number;
  /** Minutos médios entre a entrada e o corretor, dos distribuídos na janela; null sem distribuídos. */
  avgAssignMinutes: number | null;
  salesTotal: number;
  salesValue: number;
  /** Entraram na janela anterior de mesmo tamanho (comparativo "sobre ontem"); null quando não se aplica. */
  previousArrived: number | null;
  hours: PulseHour[];
};

export type BucketRow = { bucket: number; value: number };

/** Junta linhas `{ bucket, value }` em um vetor de 12 faixas (faixa fora do intervalo cai na borda). */
export function toBuckets(rows: readonly BucketRow[], size = PULSE_BUCKETS): number[] {
  const out = Array.from({ length: size }, () => 0);
  for (const row of rows) {
    const index = Math.min(size - 1, Math.max(0, Math.floor(Number(row.bucket))));
    out[index] += Number(row.value) || 0;
  }
  return out;
}

/** Entradas por hora (06h a 19h), com zero nas horas sem entrada. */
export function toHours(rows: readonly { hour: number; channel: string; total: number }[]): PulseHour[] {
  const out: PulseHour[] = [];
  for (let hour = PULSE_FIRST_HOUR; hour <= PULSE_LAST_HOUR; hour += 1) out.push({ hour, whatsapp: 0, form: 0 });
  for (const row of rows) {
    const slot = out.find((item) => item.hour === Number(row.hour));
    if (!slot) continue;
    if (row.channel === "whatsapp") slot.whatsapp += Number(row.total) || 0;
    else slot.form += Number(row.total) || 0;
  }
  return out;
}

export function emptyPulse(): DashboardPulse {
  return {
    arrived: toBuckets([]), qualified: toBuckets([]), distributed: toBuckets([]), sales: toBuckets([]),
    distributedTotal: 0, avgAssignMinutes: null, salesTotal: 0, salesValue: 0, previousArrived: null, hours: toHours([]),
  };
}

/** "+12% sobre ontem" / "-8% sobre a semana anterior"; null sem base de comparação. */
export function compareNote(current: number, previous: number | null, periodWord: string): string | null {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? `Igual a ${periodWord}` : null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return `Igual a ${periodWord}`;
  return `${change > 0 ? "+" : ""}${change}% sobre ${periodWord}`;
}
