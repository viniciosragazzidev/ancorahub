/** Rótulo do grupo por data na lista do diretor: Hoje, Ontem, Esta semana (7 dias) ou Mais antigas. */
export function conversationDayGroup(value: string | null | undefined, now: Date = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 7) return "Esta semana";
  return "Mais antigas";
}
