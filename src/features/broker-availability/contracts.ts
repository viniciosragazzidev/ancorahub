export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export type BrokerAvailabilityWindowInput = {
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
};
