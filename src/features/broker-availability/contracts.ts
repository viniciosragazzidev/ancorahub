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

/** Default day for every broker (2026-09-26): 08:00–19:00. The database seeds it
 *  on every new broker membership (migration 0162); the editor starts from it. */
export const DEFAULT_AVAILABILITY_HOURS = { startsAt: "08:00", endsAt: "19:00" } as const;

/** Every day of the week, 08:00–19:00. */
export const DEFAULT_BROKER_AVAILABILITY: BrokerAvailabilityWindowInput[] = WEEKDAY_LABELS.map((_, dayOfWeek) => ({ dayOfWeek, ...DEFAULT_AVAILABILITY_HOURS }));

type DatabaseErrorShape = {
  code?: string;
  message?: string;
  query?: string;
  cause?: DatabaseErrorShape;
};

/**
 * Limits the temporary compatibility fallback to this exact optional feature
 * table. Other database errors must still reach the route error boundary.
 */
export function isBrokerAvailabilityTableMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const databaseError = error as DatabaseErrorShape;
  const cause = databaseError.cause;
  const code = databaseError.code ?? cause?.code;
  const diagnostic = [
    databaseError.message,
    databaseError.query,
    cause?.message,
    cause?.query,
  ].filter(Boolean).join(" ");

  return code === "42P01" && diagnostic.includes("broker_availability_windows");
}
