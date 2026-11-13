import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { schema } from "@/shared/db";

/**
 * Always table-qualified: in a single-table query Drizzle renders `"id"` unqualified, which inside the correlated
 * subqueries below would resolve to the subquery's own `id` column and silently return wrong balances.
 */
const ENTRY_ID = sql.raw('"erp_financial_entries"."id"');

/**
 * Open balance of an entry, computed in SQL (one pass, index-backed by `(tenant_id, entry_id)`):
 * amount − confirmed cash (reversals subtract) − pending payments − confirmed offsets − pending offset allocations.
 * Same rule as `ledger.ts` + `offset-balances.ts`, used for lists that must not loop per row.
 */
export function openBalanceSql(tenantId: string): SQL<number> {
  const entryId = ENTRY_ID;
  return sql<number>`(${schema.erpFinancialEntries.amountCents}
    - coalesce((SELECT sum(CASE WHEN s.status = 'confirmed' AND s.kind = 'reversal' THEN -s.amount_cents
        WHEN s.status = 'confirmed' OR (s.status = 'pending' AND s.kind = 'payment') THEN s.amount_cents ELSE 0 END)
      FROM erp_settlements s WHERE s.tenant_id = ${tenantId} AND s.entry_id = ${entryId}), 0)
    - CASE WHEN ${schema.erpFinancialEntries.kind} = 'broker_commission' THEN coalesce((SELECT sum(CASE WHEN o.status = 'confirmed' AND o.kind = 'reversal' THEN -o.amount_cents
        WHEN o.status = 'confirmed' OR (o.status = 'pending' AND o.kind = 'allocation') THEN o.amount_cents ELSE 0 END)
      FROM erp_offsets o WHERE o.tenant_id = ${tenantId} AND o.commission_entry_id = ${entryId}), 0) ELSE 0 END)::bigint`.mapWith(Number);
}

/** Entry is not in a payout that is still open (prepared, approved or paying). */
export function notInOpenPayoutSql(tenantId: string): SQL {
  return sql`NOT EXISTS (SELECT 1 FROM erp_payout_items i JOIN erp_payouts p ON p.tenant_id = i.tenant_id AND p.id = i.payout_id
    WHERE i.tenant_id = ${tenantId} AND i.entry_id = ${ENTRY_ID} AND p.status IN ('prepared', 'approved', 'paying'))`;
}

/** Confirmed settled amount of an entry (cash minus reversals, plus confirmed offsets for commissions). Pending rows do not count. */
export function confirmedSettledSql(tenantId: string): SQL<number> {
  const entryId = ENTRY_ID;
  return sql<number>`(coalesce((SELECT sum(CASE WHEN s.kind = 'reversal' THEN -s.amount_cents ELSE s.amount_cents END) FROM erp_settlements s
      WHERE s.tenant_id = ${tenantId} AND s.entry_id = ${entryId} AND s.status = 'confirmed'), 0)
    + CASE WHEN ${schema.erpFinancialEntries.kind} = 'broker_commission' THEN coalesce((SELECT sum(CASE WHEN o.kind = 'reversal' THEN -o.amount_cents ELSE o.amount_cents END) FROM erp_offsets o
      WHERE o.tenant_id = ${tenantId} AND o.commission_entry_id = ${entryId} AND o.status = 'confirmed'), 0) ELSE 0 END)::bigint`.mapWith(Number);
}
