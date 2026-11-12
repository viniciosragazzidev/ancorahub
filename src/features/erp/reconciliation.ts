import "server-only";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, requireErpAccess } from "./access";
import { ErpError, FINANCIAL_KINDS, FINANCIAL_LABELS, type FinancialKind } from "./contracts";
import { DIVERGENCE_LABELS, legacyDivergence } from "./commission-core";
import { settledCents } from "./ledger";

export type ReconciliationIssue = { key: string; group: "evidence" | "approval" | "movement" | "overdue" | "legacy"; title: string; detail: string; href: string; amountCents: number | null };
export const ISSUE_GROUPS: Record<ReconciliationIssue["group"], string> = {
  evidence: "Sem evidência", approval: "Aguardando aprovação", movement: "Liquidação ou compensação a conferir", overdue: "Vencido sem liquidação registrada", legacy: "Divergência com o cronograma",
};

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(new Date());
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const kindLabel = (kind: string) => (FINANCIAL_KINDS as readonly string[]).includes(kind) ? FINANCIAL_LABELS[kind as FinancialKind] : kind;

/** Exception queue: what needs a person. Absence of data is never read as default or payment. */
export async function getReconciliation() {
  const auth = await requireErpAccess("finance", "erp_view_finance");
  if (!canSeeAgencyBooks(auth.context) || auth.scope.mode === "owners") throw new ErpError("A conciliação exige delegação financeira para a unidade ou empresa.");
  const db = getDatabase(); const tenantId = auth.context.tenantId; const scope = erpScopeSql(auth.scope, schema.erpFinancialEntries.branchId, schema.erpFinancialEntries.ownerId);
  const [submitted, pendingMovements, pendingOffsets, overdueCandidates, linked] = await Promise.all([
    db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.status, "submitted"), scope)).limit(300),
    db.select({ movement: schema.erpSettlements, reference: schema.erpFinancialEntries.reference }).from(schema.erpSettlements).innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.id, schema.erpSettlements.entryId)))
      .where(and(eq(schema.erpSettlements.tenantId, tenantId), eq(schema.erpSettlements.status, "pending"), scope)).limit(300),
    db.select({ offset: schema.erpOffsets, reference: schema.erpFinancialEntries.reference }).from(schema.erpOffsets).innerJoin(schema.erpFinancialEntries, and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.id, schema.erpOffsets.commissionEntryId)))
      .where(and(eq(schema.erpOffsets.tenantId, tenantId), eq(schema.erpOffsets.status, "pending"), scope)).limit(300),
    db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.status, "approved"), lt(schema.erpFinancialEntries.dueOn, today()), scope)).limit(500),
    db.select({ entry: schema.erpFinancialEntries, legacyStatus: schema.commissionSchedule.status }).from(schema.erpFinancialEntries)
      .innerJoin(schema.commissionSchedule, and(eq(schema.commissionSchedule.tenantId, tenantId), eq(schema.commissionSchedule.id, schema.erpFinancialEntries.originCommissionId)))
      .where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), isNotNull(schema.erpFinancialEntries.originCommissionId), inArray(schema.erpFinancialEntries.status, ["submitted", "approved"]), scope)).limit(1000),
  ]);
  const settleIds = [...new Set([...overdueCandidates, ...linked.map((row) => row.entry)].map((entry) => entry.id))];
  const [movements, offsets] = settleIds.length ? await Promise.all([
    db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, tenantId), inArray(schema.erpSettlements.entryId, settleIds))),
    db.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, tenantId), inArray(schema.erpOffsets.commissionEntryId, settleIds))),
  ]) : [[], []];
  const settledOf = (entry: { id: string; kind: string }) => settledCents(movements.filter((row) => row.entryId === entry.id)) + (entry.kind === "broker_commission" ? settledCents(offsets.filter((row) => row.commissionEntryId === entry.id)) : 0);
  const issues: ReconciliationIssue[] = [];
  for (const entry of submitted) issues.push({ key: `e-${entry.id}`, group: entry.evidenceDocumentId ? "approval" : "evidence", title: `${kindLabel(entry.kind)} · ${entry.reference}`, detail: entry.evidenceDocumentId ? "Evidência anexada; falta a aprovação independente." : "Anexe a evidência do valor conferido antes da aprovação.", href: `/financeiro/lancamentos/${entry.id}`, amountCents: entry.amountCents });
  for (const { movement, reference } of pendingMovements) issues.push({ key: `m-${movement.id}`, group: "movement", title: `${movement.kind === "reversal" ? "Estorno" : "Liquidação"} · ${reference}`, detail: movement.payoutId ? "Confira pelo repasse correspondente." : `Data do fato ${movement.occurredOn.split("-").reverse().join("/")}.`, href: movement.payoutId ? `/financeiro/repasses/${movement.payoutId}` : `/financeiro/lancamentos/${movement.entryId}`, amountCents: movement.amountCents });
  for (const { offset, reference } of pendingOffsets) issues.push({ key: `o-${offset.id}`, group: "movement", title: `${offset.kind === "reversal" ? "Estorno de compensação" : "Compensação"} · ${reference}`, detail: "Revise na tela de adiantamentos.", href: "/financeiro/adiantamentos", amountCents: offset.amountCents });
  for (const entry of overdueCandidates) {
    if (entry.kind === "client_premium") continue;
    const open = entry.amountCents - settledOf(entry);
    if (open > 0) issues.push({ key: `v-${entry.id}`, group: "overdue", title: `${kindLabel(entry.kind)} · ${entry.reference}`, detail: `Venceu em ${entry.dueOn.split("-").reverse().join("/")}. Ausência de registro não significa inadimplência: confira a fonte.`, href: `/financeiro/lancamentos/${entry.id}`, amountCents: open });
  }
  for (const { entry, legacyStatus } of linked) {
    const divergence = legacyDivergence(legacyStatus, { status: entry.status, amountCents: entry.amountCents, settledCents: settledOf(entry) });
    if (divergence) issues.push({ key: `l-${entry.id}`, group: "legacy", title: `Comissão · ${entry.reference}`, detail: DIVERGENCE_LABELS[divergence], href: `/financeiro/lancamentos/${entry.id}`, amountCents: entry.amountCents });
  }
  await auditErp(db, { tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.reconciliation.viewed", entityType: "erp_access", entityId: "reconciliation", metadata: { issues: issues.length } });
  return { calculatedAt: new Date().toISOString(), issues, truncated: [submitted, pendingMovements, pendingOffsets].some((rows) => rows.length >= 300) };
}
