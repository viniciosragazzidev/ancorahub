/** Janela de ligações do Call Âncora: segunda a sábado, 08:00 às 20:00 (São Paulo). */
export const CALL_ANCORA_WINDOW = { startHour: 8, endHour: 20 } as const;

export const CALL_ANCORA_OUTSIDE_WINDOW_MESSAGE = "Fora do horário de ligações (segunda a sábado, 8h às 20h).";

export function isCallAncoraWindowOpen(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (weekday === "Sun") return false;
  return hour >= CALL_ANCORA_WINDOW.startHour && hour < CALL_ANCORA_WINDOW.endHour;
}
