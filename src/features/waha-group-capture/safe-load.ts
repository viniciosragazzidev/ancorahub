import { isUndefinedTableError, postgresErrorCode } from "@/shared/db/postgres-errors";

export type SafeLoad<T> = { ok: true; value: T } | { ok: false; missingTables: boolean };

/**
 * Runs a page's database read without letting a failure take the whole page
 * down. `missingTables` is true when the cause is a migration that was not
 * applied (migrations are applied by hand), so the page can say that.
 * Only the SQLSTATE is logged: no query, no data.
 */
export async function safeLoad<T>(label: string, load: () => Promise<T>): Promise<SafeLoad<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    const missingTables = isUndefinedTableError(error);
    console.error(`[${label}] load_failed`, { code: postgresErrorCode(error) ?? null, missingTables });
    return { ok: false, missingTables };
  }
}
