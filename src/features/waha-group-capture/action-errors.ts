import { postgresErrorCode } from "@/shared/db/postgres-errors";

/**
 * The text a screen may show for a failed action. A database error carries the
 * whole query and its values, so it never reaches the person: only a short
 * explanation and the SQLSTATE do. Errors the code raised itself (the relay is
 * unreachable, the number is not found) already read well and pass through.
 */
export function describeActionError(error: unknown, fallback: string): string {
  const code = postgresErrorCode(error);
  if (code === "23514") {
    return `${fallback} O banco ainda não aceita este tipo de número: falta aplicar a migração 0206.`;
  }
  if (code === "42P01" || code === "42883") {
    return `${fallback} Falta aplicar migrações no banco (erro ${code}).`;
  }
  if (code) return `${fallback} Erro de banco (${code}).`;
  if (error instanceof Error) {
    // A failed query whose cause did not carry a code: still not for the screen.
    return /^Failed query/i.test(error.message) ? `${fallback} Erro de banco.` : error.message;
  }
  return fallback;
}
