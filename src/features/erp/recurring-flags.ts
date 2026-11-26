import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/shared/db";
import type { ErpDatabase } from "./access";

let recurringKnownReady = false;
/** True depois da migração 0242. Antes dela a tela de despesas segue como antes e nada se repete. */
export async function isRecurringExpensesReady(db: ErpDatabase) {
  if (recurringKnownReady) return true;
  const [row] = await db.execute(sql`SELECT to_regclass('public.erp_recurring_expenses') IS NOT NULL AND to_regclass('public.erp_recurring_expense_runs') IS NOT NULL AS ready`);
  recurringKnownReady = (row as { ready?: boolean } | undefined)?.ready === true;
  return recurringKnownReady;
}

/** Quais destes lançamentos pertencem a uma repetição ativa (a origem ou um mês já gerado). */
export async function recurringEntryIds(db: ErpDatabase, tenantId: string, ids: readonly string[]) {
  if (!ids.length || !(await isRecurringExpensesReady(db))) return new Set<string>();
  const rules = schema.erpRecurringExpenses; const runs = schema.erpRecurringExpenseRuns;
  const [origins, generated] = await Promise.all([
    db.select({ id: rules.originEntryId }).from(rules)
      .where(and(eq(rules.tenantId, tenantId), eq(rules.status, "active"), inArray(rules.originEntryId, [...ids]))),
    db.select({ id: runs.entryId }).from(runs)
      .innerJoin(rules, and(eq(rules.tenantId, tenantId), eq(rules.id, runs.recurringId)))
      .where(and(eq(runs.tenantId, tenantId), eq(rules.status, "active"), inArray(runs.entryId, [...ids]))),
  ]);
  return new Set([...origins, ...generated].map((row) => row.id));
}
