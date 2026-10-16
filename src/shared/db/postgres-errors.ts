/**
 * The SQLSTATE of a database error. Drizzle and postgres.js wrap the driver
 * error, so the code is looked up through `cause` as well.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** 42P01: a table or view that does not exist, typically a migration that was not applied. */
export const isUndefinedTableError = (error: unknown) => postgresErrorCode(error) === "42P01";

/** 42883: a function that does not exist, typically a migration that was not applied. */
export const isUndefinedFunctionError = (error: unknown) => postgresErrorCode(error) === "42883";
