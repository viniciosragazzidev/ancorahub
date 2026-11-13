import "server-only";
import { and, asc, eq, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import { confirmedSettledSql, openBalanceSql } from "./balances";
import { todayInSaoPaulo } from "./shared";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, requireErpAccess } from "./access";
import { ErpError, FINANCIAL_KINDS, FINANCIAL_LABELS, type FinancialKind } from "./contracts";
import { DIVERGENCE_LABELS, legacyDivergence } from "./commission-core";

/** Oldest items per group; `truncated` tells the screen when a group has more. */
export const QUEUE_LIMIT = 300;

export const ISSUE_GROUP_KEYS = ["evidence", "approval", "movement", "overdue", "legacy"] as const;
export type ReconciliationGroup = (typeof ISSUE_GROUP_KEYS)[number];
export type ReconciliationIssue = { key: string; group: ReconciliationGroup; title: string; detail: string; href: string; amountCents: number | null };
export const ISSUE_GROUPS: Record<ReconciliationGroup, string> = {
  evidence: "Sem evidência", approval: "Aguardando aprovação", movement: "Liquidação ou compensação a conferir", overdue: "Vencido sem liquidação registrada", legacy: "Divergência com o cronograma",
};

const kindLabel = (kind: string) => (FINANCIAL_KINDS as readonly string[]).includes(kind) ? FINANCIAL_LABELS[kind as FinancialKind] : kind;

/** Exception queue: what needs a person. Absence of data is never read as default or payment. */
export async function getReconciliation() {
  const auth = await requireErpAccess("finance", "erp_view_finance");
  if (!canSeeAgencyBooks(auth.context) || auth.scope.mode === "owners") throw new ErpError("A conciliação exige delegação financeira para a unidade ou empresa.");
  const db = getDatabase(); const tenantId = auth.context.tenantId; const scope = erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId);
  const settled = confirmedSettledSql(tenantId);
  const open = openBalanceSql(tenantId);
  const entry = schema.erpFinancialEntries;
  const [submitted, pendingMovements, pendingOffsets, overdue, linked] = await Promise.all([
    db.select().from(entry).where(and(eq(entry.tenantId, tenantId), eq(entry.status, "submitted"), scope)).orderBy(asc(entry.createdAt)).limit(QUEUE_LIMIT + 1),
    db.select({ movement: schema.erpSettlements, reference: entry.reference }).from(schema.erpSettlements).innerJoin(entry, and(eq(entry.tenantId, tenantId), eq(entry.id, schema.erpSettlements.entryId)))
      .where(and(eq(schema.erpSettlements.tenantId, tenantId), eq(schema.erpSettlements.status, "pending"), scope)).orderBy(asc(schema.erpSettlements.createdAt)).limit(QUEUE_LIMIT + 1),
    db.select({ offset: schema.erpOffsets, reference: entry.reference }).from(schema.erpOffsets).innerJoin(entry, and(eq(entry.tenantId, tenantId), eq(entry.id, schema.erpOffsets.commissionEntryId)))
      .where(and(eq(schema.erpOffsets.tenantId, tenantId), eq(schema.erpOffsets.status, "pending"), scope)).orderBy(asc(schema.erpOffsets.createdAt)).limit(QUEUE_LIMIT + 1),
    // Open balance in SQL, oldest due first: fully settled entries never fill the queue.
    db.select({ id: entry.id, kind: entry.kind, reference: entry.reference, dueOn: entry.dueOn, openCents: open }).from(entry)
      .where(and(eq(entry.tenantId, tenantId), eq(entry.status, "approved"), ne(entry.kind, "client_premium"), lt(entry.dueOn, todayInSaoPaulo()), scope, sql`${open} > 0`)).orderBy(asc(entry.dueOn)).limit(QUEUE_LIMIT + 1),
    // Only rows that actually diverge from the legacy schedule.
    db.select({ id: entry.id, reference: entry.reference, status: entry.status, amountCents: entry.amountCents, legacyStatus: schema.commissionSchedule.status, settledCents: settled }).from(entry)
      .innerJoin(schema.commissionSchedule, and(eq(schema.commissionSchedule.tenantId, tenantId), eq(schema.commissionSchedule.id, entry.originCommissionId)))
      .where(and(eq(entry.tenantId, tenantId), isNotNull(entry.originCommissionId), inArray(entry.status, ["submitted", "approved"]), scope,
        sql`(${schema.commissionSchedule.status} IN ('cancelled', 'chargeback_pending') OR (${schema.commissionSchedule.status} = 'paid' AND ${settled} < ${entry.amountCents}) OR (${schema.commissionSchedule.status} = 'pending' AND ${settled} >= ${entry.amountCents}))`))
      .orderBy(asc(entry.dueOn)).limit(QUEUE_LIMIT + 1),
  ]);
  const lists = [submitted, pendingMovements, pendingOffsets, overdue, linked];
  const issues: ReconciliationIssue[] = [];
  for (const row of submitted.slice(0, QUEUE_LIMIT)) issues.push({ key: `e-${row.id}`, group: row.evidenceDocumentId ? "approval" : "evidence", title: `${kindLabel(row.kind)} · ${row.reference}`, detail: row.evidenceDocumentId ? "Evidência anexada; falta a aprovação independente." : "Anexe a evidência do valor conferido antes da aprovação.", href: `/financeiro/lancamentos/${row.id}`, amountCents: row.amountCents });
  for (const { movement, reference } of pendingMovements.slice(0, QUEUE_LIMIT)) issues.push({ key: `m-${movement.id}`, group: "movement", title: `${movement.kind === "reversal" ? "Estorno" : "Liquidação"} · ${reference}`, detail: movement.payoutId && movement.kind === "payment" ? "Confira pelo repasse correspondente." : `Data do fato ${movement.occurredOn.split("-").reverse().join("/")}.`, href: movement.payoutId && movement.kind === "payment" ? `/financeiro/repasses/${movement.payoutId}` : `/financeiro/lancamentos/${movement.entryId}`, amountCents: movement.amountCents });
  for (const { offset, reference } of pendingOffsets.slice(0, QUEUE_LIMIT)) issues.push({ key: `o-${offset.id}`, group: "movement", title: `${offset.kind === "reversal" ? "Estorno de compensação" : "Compensação"} · ${reference}`, detail: "Revise na tela de adiantamentos.", href: "/financeiro/adiantamentos", amountCents: offset.amountCents });
  for (const row of overdue.slice(0, QUEUE_LIMIT)) issues.push({ key: `v-${row.id}`, group: "overdue", title: `${kindLabel(row.kind)} · ${row.reference}`, detail: `Venceu em ${row.dueOn.split("-").reverse().join("/")}. Ausência de registro não significa inadimplência: confira a fonte.`, href: `/financeiro/lancamentos/${row.id}`, amountCents: row.openCents });
  for (const row of linked.slice(0, QUEUE_LIMIT)) {
    const divergence = legacyDivergence(row.legacyStatus, { status: row.status, amountCents: row.amountCents, settledCents: row.settledCents });
    if (divergence) issues.push({ key: `l-${row.id}`, group: "legacy", title: `Comissão · ${row.reference}`, detail: DIVERGENCE_LABELS[divergence], href: `/financeiro/lancamentos/${row.id}`, amountCents: row.amountCents });
  }
  await auditErp(db, { tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.reconciliation.viewed", entityType: "erp_access", entityId: "reconciliation", metadata: { issues: issues.length } });
  return { calculatedAt: new Date().toISOString(), issues, truncated: lists.some((rows) => rows.length > QUEUE_LIMIT) };
}
