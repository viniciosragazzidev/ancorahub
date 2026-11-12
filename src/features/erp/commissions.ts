import "server-only";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, canSeeAgencyBooks, erpScopeSql, getErpEffectiveAccess, requireErpAccess } from "./access";
import { ErpError, recordIdSchema } from "./contracts";
import { deterministicUuid, legacyDivergence, numericToCents, scheduleDueOn } from "./commission-core";
import { financialTransaction, prepareFinancialEntryInTransaction } from "./finance";
import { settledCents } from "./ledger";

const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const filtersSchema = z.object({ competence: period.optional(), page: z.coerce.number().int().min(1).max(10_000).default(1) });

/** Legacy schedule (previsto) side by side with the conferred ERP fact (conferido/pago). */
export async function getCommissionOverview(raw: unknown) {
  const filters = filtersSchema.parse(raw);
  const auth = await requireErpAccess("finance", "erp_view_finance"); const db = getDatabase();
  const conditions = and(eq(schema.commissionSchedule.tenantId, auth.context.tenantId), eq(schema.sales.tenantId, auth.context.tenantId),
    erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId), filters.competence ? eq(schema.commissionSchedule.referenceMonth, filters.competence) : undefined);
  const base = db.select({ id: schema.commissionSchedule.id, saleId: schema.sales.id, monthNumber: schema.commissionSchedule.monthNumber, referenceMonth: schema.commissionSchedule.referenceMonth,
    percentage: schema.commissionSchedule.percentage, amount: schema.commissionSchedule.amount, legacyStatus: schema.commissionSchedule.status, clientName: schema.leads.nome,
    brokerId: schema.sales.brokerId, brokerName: schema.user.name, saleStatus: schema.sales.status })
    .from(schema.commissionSchedule).innerJoin(schema.sales, and(eq(schema.sales.id, schema.commissionSchedule.saleId), eq(schema.sales.tenantId, auth.context.tenantId)))
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt)))
    .leftJoin(schema.user, eq(schema.user.id, schema.sales.brokerId));
  const [rows, total] = await Promise.all([
    base.where(conditions).orderBy(desc(schema.commissionSchedule.referenceMonth), asc(schema.leads.nome), asc(schema.commissionSchedule.monthNumber)).limit(50).offset((filters.page - 1) * 50),
    db.select({ value: count() }).from(schema.commissionSchedule).innerJoin(schema.sales, and(eq(schema.sales.id, schema.commissionSchedule.saleId), eq(schema.sales.tenantId, auth.context.tenantId)))
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt))).where(conditions),
  ]);
  const ids = rows.map((row) => row.id);
  const entries = ids.length ? await db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), inArray(schema.erpFinancialEntries.originCommissionId, ids))) : [];
  const entryIds = entries.map((entry) => entry.id);
  const [movements, offsets] = entryIds.length ? await Promise.all([
    db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, auth.context.tenantId), inArray(schema.erpSettlements.entryId, entryIds))),
    db.select().from(schema.erpOffsets).where(and(eq(schema.erpOffsets.tenantId, auth.context.tenantId), inArray(schema.erpOffsets.commissionEntryId, entryIds))),
  ]) : [[], []];
  const access = await getErpEffectiveAccess(auth.context);
  const agency = canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
  const canBring = agency && !auth.context.viewAs && access.capabilities.has("erp_prepare_finance");
  await auditErp(db, { tenantId: auth.context.tenantId, actorId: auth.context.viewAs?.adminUserId ?? auth.context.userId, action: "erp.commissions.viewed", entityType: "erp_access", entityId: "commissions", metadata: { count: rows.length, page: filters.page } });
  return { filters, total: Number(total[0]?.value ?? 0), agency, canBring, rows: rows.map((row) => {
    const entry = entries.find((candidate) => candidate.originCommissionId === row.id);
    const paid = entry ? settledCents(movements.filter((movement) => movement.entryId === entry.id)) : 0;
    const offset = entry ? settledCents(offsets.filter((item) => item.commissionEntryId === entry.id)) : 0;
    const expected = numericToCents(row.amount);
    return { ...row, expectedCents: expected, entry: entry ? { id: entry.id, status: entry.status, amountCents: entry.amountCents } : null,
      paidCents: paid, offsetCents: offset, divergence: legacyDivergence(row.legacyStatus, entry ? { status: entry.status, amountCents: entry.amountCents, settledCents: paid + offset } : null) };
  }) };
}

/** Brings a sale's pending legacy installments into the ERP as submitted entries (idempotent per installment). */
export async function bringScheduleToConference(raw: unknown) {
  const input = z.object({ saleId: recordIdSchema }).strict().parse(raw);
  return financialTransaction("erp_prepare_finance", async (tx, auth) => {
    if (!canSeeAgencyBooks(auth.context) || auth.scope.mode === "owners") throw new ErpError("A conferência do cronograma exige delegação financeira.");
    const [sale] = await tx.select({ id: schema.sales.id, brokerId: schema.sales.brokerId, status: schema.sales.status }).from(schema.sales)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.sales.leadId), eq(schema.leads.tenantId, auth.context.tenantId), isNull(schema.leads.deletedAt)))
      .where(and(eq(schema.sales.id, input.saleId), eq(schema.sales.tenantId, auth.context.tenantId), erpScopeSql(auth.scope, schema.leads.branchId, schema.sales.brokerId))).limit(1);
    if (!sale || sale.status !== "active") throw new ErpError("Venda ativa não encontrada no seu escopo.");
    const installments = await tx.select().from(schema.commissionSchedule).where(and(eq(schema.commissionSchedule.tenantId, auth.context.tenantId), eq(schema.commissionSchedule.saleId, sale.id), eq(schema.commissionSchedule.status, "pending")))
      .orderBy(asc(schema.commissionSchedule.monthNumber)).for("update");
    let created = 0; let skipped = 0;
    for (const installment of installments) {
      const cents = numericToCents(installment.amount);
      if (cents <= 0) { skipped += 1; continue; }
      const [existing] = await tx.select({ id: schema.erpFinancialEntries.id }).from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, auth.context.tenantId), eq(schema.erpFinancialEntries.originCommissionId, installment.id))).limit(1);
      if (existing) { skipped += 1; continue; }
      await prepareFinancialEntryInTransaction(tx, auth, { requestId: deterministicUuid(`erp:schedule:${auth.context.tenantId}:${installment.id}`), reference: `cronograma:${installment.id}`.slice(0, 100), kind: "broker_commission",
        saleId: sale.id, branchId: null, beneficiaryId: sale.brokerId, amountCents: cents, dueOn: scheduleDueOn(installment.dueDate, installment.referenceMonth), competence: installment.referenceMonth,
        description: `Parcela ${installment.monthNumber} do cronograma (${installment.percentage}%)`, evidenceDocumentId: null }, installment.id);
      created += 1;
    }
    await auditErp(tx, { tenantId: auth.context.tenantId, actorId: auth.context.userId, action: "erp.commissions.schedule_brought", entityType: "sale", entityId: sale.id, metadata: { created, skipped } });
    return { created, skipped };
  });
}

/** Legacy screens must not mark an installment paid/unpaid once the ERP controls it. */
export async function isInstallmentControlledByErp(tenantId: string, scheduleId: string) {
  const [row] = await getDatabase().select({ id: schema.erpFinancialEntries.id }).from(schema.erpFinancialEntries)
    .where(and(eq(schema.erpFinancialEntries.tenantId, tenantId), eq(schema.erpFinancialEntries.originCommissionId, scheduleId), inArray(schema.erpFinancialEntries.status, ["submitted", "approved"]))).limit(1);
  return !!row;
}
