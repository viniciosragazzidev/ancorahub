import { formatLiteDate } from "@/components/lite/format/date";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Contagem regressiva (seção 2 do plano): abaixo de 1 h `mm:ss`, abaixo de 24 h `hh:mm:ss`, acima disso `2 d 04 h`.
 * Negativo vira zero.
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days} d ${pad(hours)} h`;
  if (total >= 3_600) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Tempo desde um evento: "há 40 s", "há 12 min", "há 3 h", "há 2 d". */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `há ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

const dayKey = (value: Date | string) => formatLiteDate(value, { year: "numeric", month: "2-digit", day: "2-digit" }, "");

/**
 * Hora absoluta em São Paulo, para o primeiro render (servidor e hidratação) e para o leitor de tela:
 * "às 15:42" no mesmo dia de `reference`, "amanhã às 09:00" no dia seguinte, "28/10 às 09:00" depois.
 * `reference` vem do dado (generatedAt), nunca do relógio, para o HTML ser igual nos dois lados.
 */
export function formatAbsoluteTime(at: string, reference: string): string {
  const time = formatLiteDate(at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "");
  if (!time) return "";
  const target = dayKey(at);
  if (target === dayKey(reference)) return `às ${time}`;
  const tomorrow = new Date(new Date(reference).getTime() + 86_400_000);
  if (target === dayKey(tomorrow)) return `amanhã às ${time}`;
  return `${formatLiteDate(at, { day: "2-digit", month: "2-digit" }, "")} às ${time}`;
}
