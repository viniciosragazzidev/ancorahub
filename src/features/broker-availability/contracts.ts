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
